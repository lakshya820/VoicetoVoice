import { useEffect, useState, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Stack from 'react-bootstrap/Stack';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';
import * as io from "socket.io-client";
import '../css/VoiceAssistant.css';

// Environment variables for Azure Speech Services
const API_KEY = process.env.REACT_APP_COG_SERVICE_KEY;
const API_LOCATION = process.env.REACT_APP_COG_SERVICE_LOCATION;

// Initialize socket connection
const socket = io.connect('http://localhost:8081');

// Default KB article content (replace with your own KB content)
const DEFAULT_KB_ARTICLE = `
Axis Atmos Overview
Axis Atmos Cloud is designed to securely connect any user to business applications or resources, regardless of their location. It supports seamless integration with Zero Trust controls, providing continuous, application-centric visibility and secure access for organizations in the modern digital transformation landscape. Whether employees work from anywhere or interact with contingent workers or third parties, Axis Atmos ensures secure connectivity through a single, centrally managed service.
________________________________________
1.	Deployment of Axis Atmos
o	Axis Atmos Cloud will be deployed on Windows devices via Intune and Mac devices via JAMF.
o	After deployment, the device will require a restart.
o	Once restarted, you can locate the application under the name Axis Client on both Windows and Mac.
________________________________________
2.	Prerequisites:
1.	Ensure that other VPN solutions like Pulse Secure or Aruba VIA are not active while using the Axis Agent.
2.	Confirm that your HPE email is registered with Work multi-factor authentication (MFA). 
	You can register or verify at the Workforce OKTA MFA Registration Page.
	Note: As per HPE's security policy, Axis Atmos requires reauthentication every 7 days for HPE Employees and every 8 Hours for HPE Contingent workers. You’ll receive a system tray notification 15 minutes before the reauthentication is required, giving you time to complete the process.
________________________________________
3.	Axis Atmos Setup and Operations
To ensure a smooth installation and optimal performance of the Axis Atmos Agent on both Windows and Mac devices, follow the steps provided in the articles below:
1.	Setup Axis Atmos Client on Windows: 
	Step-by-step instructions to install and configure Axis Atmos on Windows.
2.	Setup Axis Atmos Client on Mac: 
	Detailed guide for installing and setting up the Axis Atmos client on Mac devices.
3.	Frequently Asked Questions (FAQ): Axis Atmos 
	A compilation of common questions and troubleshooting tips to assist with any issues during or after the installation.
________________________________________
Support Information
For further help, go to myITsupport and click the green Virtual Agent icon. You can also call IT support or ask questions on the #ask-myitsupport Slack channel for assistance.
`;

interface Message {
  role: string;
  content: string;
  timestamp?: number;
}

const VoiceAssistant: React.FC = () => {
  // State variables
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [processingText, setProcessingText] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [kbArticle, setKbArticle] = useState<string>(DEFAULT_KB_ARTICLE);
  
  // Audio control states
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioPaused, setIsAudioPaused] = useState<boolean>(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  
  // References
  const audioStream = useRef<MediaStream | null>(null);
  const recognizer = useRef<speechsdk.SpeechRecognizer | null>(null);
  const synthesizer = useRef<speechsdk.SpeechSynthesizer | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Set up Azure Speech SDK recognizer and synthesizer
  const setupSpeechServices = async (): Promise<void> => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
          volume: 1
        }
      });
      
      audioStream.current = stream;
      
      // Set up speech config
      const speechConfig = speechsdk.SpeechConfig.fromSubscription(API_KEY!, API_LOCATION!);
      speechConfig.speechRecognitionLanguage = "en-US";
      
      // Create audio config from microphone
      const audioConfig = speechsdk.AudioConfig.fromStreamInput(stream);
      
      // Create speech recognizer
      recognizer.current = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
      
      // Set up speech synthesizer
      synthesizer.current = new speechsdk.SpeechSynthesizer(speechConfig);
      
      // Set up recognizer event handlers
      recognizer.current.recognized = (s, e) => {
        if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
          setRecognizedText(prev => prev + " " + e.result.text);
        }
      };
      
      recognizer.current.recognizing = (s, e) => {
        // Real-time transcription updates (optional)
      };
      
      recognizer.current.canceled = (s, e) => {
        console.error("Speech recognition canceled:", e.errorDetails);
        stopListening();
      };
      
      console.log("Speech services initialized successfully");
    } catch (error) {
      console.error("Error setting up speech services:", error);
      alert("Error accessing microphone or setting up speech services. Please check permissions.");
    }
  };

  // Start listening for audio input
  const startListening = async (): Promise<void> => {
    if (!recognizer.current) {
      await setupSpeechServices();
    }
    
    try {
      setIsListening(true);
      setRecognizedText("");
      await recognizer.current?.startContinuousRecognitionAsync();
      console.log("Started listening");
    } catch (error) {
      console.error("Error starting speech recognition:", error);
    }
  };

  // Stop listening for audio input
  const stopListening = async (): Promise<void> => {
    if (recognizer.current) {
      try {
        await recognizer.current.stopContinuousRecognitionAsync();
        setIsListening(false);
        setProcessingText(true);
        console.log("Stopped listening, processing text:", recognizedText);
        
        // Process the recognized text with OpenAI
        if (recognizedText.trim()) {
          await processWithOpenAI(recognizedText);
        } else {
          setProcessingText(false);
        }
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
        setIsListening(false);
        setProcessingText(false);
      }
    }
  };

  // Process text with OpenAI API via WebSocket
  const processWithOpenAI = async (userInput: string): Promise<void> => {
    try {
      // Add user message to conversation history
      const userMessage: Message = { 
        role: 'user', 
        content: userInput, 
        timestamp: Date.now() 
      };
      
      const updatedHistory = [...conversationHistory, userMessage];
      setConversationHistory(updatedHistory);
      
      // Setup socket listener for responses
      socket.once("voice_assistant_response", async (data) => {
        if (data.success) {
          const aiText = data.text;
          
          // Add AI response to conversation history
          const aiMessage: Message = { 
            role: 'assistant', 
            content: aiText, 
            timestamp: Date.now() 
          };
          
          setConversationHistory([...updatedHistory, aiMessage]);
          setAiResponse(aiText);
          
          // Speak the AI response
          await speakResponse(aiText);
        } else {
          console.error('Error from server:', data.error);
          setAiResponse("Sorry, I encountered an error processing your request.");
          setProcessingText(false);
        }
      });
      
      // Send the user input to the server via WebSocket
      socket.emit("voice_assistant_input", {
        text: userInput,
        history: updatedHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        context: kbArticle
      });
      
    } catch (error) {
      console.error('Error processing voice input:', error);
      setAiResponse("Sorry, I encountered an error processing your request.");
      setProcessingText(false);
    }
  };

  // Speak the AI response using Azure text-to-speech
  const speakResponse = async (text: string): Promise<void> => {
    if (synthesizer.current) {
      try {
        setIsSpeaking(true);
        
        // Create a SpeechConfig for the synthesizer
        const speechConfig = speechsdk.SpeechConfig.fromSubscription(API_KEY!, API_LOCATION!);
        
        // Configure to return audio data
        speechConfig.speechSynthesisOutputFormat = speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
        
        // Create a synthesizer with the speech config (no audio config to prevent auto-playback)
        const tempSynthesizer = new speechsdk.SpeechSynthesizer(speechConfig, null);
        
        // Synthesize speech to an audio buffer
        tempSynthesizer.speakTextAsync(
          text,
          result => {
            if (result.reason === speechsdk.ResultReason.SynthesizingAudioCompleted) {
              console.log("Speech synthesis completed");
              
              // Create a blob from the audio data
              const audioBlob = new Blob([result.audioData], { type: 'audio/mp3' });
              
              // Create a URL for the blob
              const url = URL.createObjectURL(audioBlob);
              
              // Clean up previous audio URL if exists
              if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
              }
              
              setAudioUrl(url);
              
              // Play using the audio element
              if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.onended = () => {
                  setIsSpeaking(false);
                  setProcessingText(false);
                };
                
                setAudioPlayer(audioRef.current);
                audioRef.current.play().catch(e => {
                  console.error("Error playing audio:", e);
                  setIsSpeaking(false);
                  setProcessingText(false);
                });
              }
              
              // Close the temporary synthesizer
              tempSynthesizer.close();
            } else {
              console.error("Speech synthesis failed:", result.errorDetails);
              setIsSpeaking(false);
              setProcessingText(false);
              tempSynthesizer.close();
            }
          },
          error => {
            console.error("Speech synthesis error:", error);
            setIsSpeaking(false);
            setProcessingText(false);
            tempSynthesizer.close();
          }
        );
      } catch (error) {
        console.error("Error speaking response:", error);
        setIsSpeaking(false);
        setProcessingText(false);
      }
    } else {
      console.error("Speech synthesizer not initialized");
      setIsSpeaking(false);
      setProcessingText(false);
    }
  };

  // Audio control functions
  const pauseAudio = () => {
    if (audioPlayer && !isAudioPaused) {
      audioPlayer.pause();
      setIsAudioPaused(true);
    }
  };

  const resumeAudio = () => {
    if (audioPlayer && isAudioPaused) {
      audioPlayer.play();
      setIsAudioPaused(false);
    }
  };

  const replayAudio = () => {
    if (audioPlayer) {
      audioPlayer.currentTime = 0;
      audioPlayer.play();
      setIsAudioPaused(false);
    }
  };
  
  // Update KB article content
  const updateKbArticle = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setKbArticle(e.target.value);
  };

  // Initialize socket connection and clean up resources when component unmounts
  useEffect(() => {
    // Socket connection setup
    socket.on("connect", () => {
      console.log("WebSocket connected with ID:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
    });

    // Clean up function
    return () => {
      const cleanup = async () => {
        try {
          // Disconnect socket listeners
          socket.off("voice_assistant_response");
          socket.off("connect");
          socket.off("disconnect");
          socket.off("connect_error");
          
          // Clean up speech resources
          if (recognizer.current) {
            await recognizer.current.close();
          }
          if (synthesizer.current) {
            synthesizer.current.close();
          }
          if (audioStream.current) {
            audioStream.current.getTracks().forEach(track => track.stop());
          }
          
          // Clean up audio URLs
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }
        } catch (error) {
          console.error("Error during cleanup:", error);
        }
      };
      cleanup();
    };
  }, [audioUrl]);

  // Scroll to the bottom of the conversation container
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversationHistory]);

  return (
    <Container className="voice-assistant-container">
      <Row className="header-row">
        <Col>
          <h2>Voice Assistant</h2>
          <p className="subtitle">Ask a question using your voice and get an audio response</p>
        </Col>
      </Row>
      
      <Row className="main-content">
        <Col md={8}>
          <Card className="conversation-card">
            <Card.Header>Conversation</Card.Header>
            <Card.Body className="conversation-body" ref={conversationRef}>
              {conversationHistory.map((message, index) => (
                <div 
                  key={index}
                  className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                >
                  <div className="message-content">
                    {message.content}
                  </div>
                </div>
              ))}
              
              {isListening && (
                <div className="status-indicator listening">
                  Listening... <span className="pulse"></span>
                </div>
              )}
              
              {processingText && !isSpeaking && (
                <div className="status-indicator processing">
                  Processing... <span className="spinner"></span>
                </div>
              )}
              
              {isSpeaking && (
                <div className="status-indicator speaking">
                  Speaking... <span className="wave"></span>
                </div>
              )}
            </Card.Body>
            
            {/* Audio Player */}
            <Card.Footer className="audio-controls">
              <audio ref={audioRef} style={{ display: 'none' }} />
              
              {audioUrl && (
                <div className="audio-buttons">
                  {isAudioPaused ? (
                    <Button 
                      variant="primary"
                      onClick={resumeAudio}
                      className="audio-button"
                    >
                      <i className="bi bi-play-fill"></i> Resume
                    </Button>
                  ) : (
                    <Button 
                      variant="primary"
                      onClick={pauseAudio}
                      className="audio-button"
                      disabled={!isSpeaking}
                    >
                      <i className="bi bi-pause-fill"></i> Pause
                    </Button>
                  )}
                  
                  <Button 
                    variant="secondary"
                    onClick={replayAudio}
                    className="audio-button"
                  >
                    <i className="bi bi-arrow-repeat"></i> Replay
                  </Button>
                </div>
              )}
            </Card.Footer>
          </Card>
        </Col>
        
        <Col md={4}>
          <Card className="controls-card">
            <Card.Header>Controls</Card.Header>
            <Card.Body>
              <Stack gap={3}>
                <div>
                  <Button 
                    variant={isListening ? "danger" : "primary"}
                    size="lg"
                    className="control-button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={processingText || isSpeaking}
                  >
                    {isListening ? 'Stop Listening' : 'Start Listening'}
                  </Button>
                </div>
                
                <div className="kb-article-section">
                  <Form.Label htmlFor="kb-article-textarea">Knowledge Base Article:</Form.Label>
                  <Form.Control
                    as="textarea"
                    id="kb-article-textarea"
                    className="kb-article-textarea"
                    placeholder="Paste or enter KB article content here..."
                    value={kbArticle}
                    onChange={updateKbArticle}
                    rows={10}
                  />
                </div>
              </Stack>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Row className="footer-row">
        <Col>
          <div className="note-text">
            <p>
              <strong>Note:</strong> This uses Azure Speech Services for speech-to-text and text-to-speech, 
              and OpenAI API for generating responses based on the KB article context.
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default VoiceAssistant;