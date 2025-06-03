import { useEffect, useState, useRef } from 'react';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';
import * as io from "socket.io-client";
import '../css/CompactVoiceAssistant.css';

// Environment variables for Azure Speech Services
const API_KEY = process.env.REACT_APP_COG_SERVICE_KEY;
const API_LOCATION = process.env.REACT_APP_COG_SERVICE_LOCATION;

// Initialize socket connection
const socket = io.connect('http://localhost:8081');

// Default KB article content - replace with your own
const DEFAULT_KB_ARTICLE = `
Install and Setup Axis Atmos Client on Windows 
29 Apr 2025 
________________________________________
Introduction
HPE has introduced Axis Atmos, a next-generation Zero Trust (ZTNA) platform that replaces Pulse Secure and Aruba VIA VPN solutions. Also known as the Axis Client or Atmos Agent, this platform provides secure access to internal HPE resources, similar to legacy VPN solutions but with enhanced security and flexibility.
________________________________________
Pre-requisites
1.	HPE Employees must use an HPE-owned and IT-managed device (managed via Intune for Windows or JAMF for Mac).
2.	HPE Contingent worker is issued an HPE device must use the HPE-provided device.
3.	All other HPE Contingent workers must use a vendor-provided or vendor-approved device that meets the following minimum requirements:
o	Windows 10 or newer
o	macOS 13 or newer
o	Disk encryption must be enabled on the device.
4.	Disable other VPN solutions such as Pulse Secure or Aruba VIA before connecting with Axis Atmos to avoid conflicts.
5.	Register your HPE email with Workforce OKTA Multi-Factor Authentication (MFA).
o	You can register for Workforce OKTA MFA here.
6.	Register Your Mobile Device for Okta Verify (if applicable)
If you use a mobile phone to access emails, join meetings, or use HPE applications, you must also register your phone for Okta Verify:
o	Without Virtual DigitalBadge (VDB) / YubiKey (YBD): Follow Slide 6 of the registration guide.
o	With Virtual DigitalBadge (VDB): Follow Slide 10 of the registration guide.
7.	Reauthentication Policy
o	As per HPE's security policy, Axis Atmos requires reauthentication every 7 days for HPE Employees and every 8 Hours for HPE Contingent workers.
o	You will receive a system tray notification 15 minutes before reauthentication is required.
________________________________________
Steps to Use Axis Atmos Client on HPE-owned and IT-managed Windows devices
For detailed instructions on setting up Axis Atmos on a Windows device, please follow the official guide: Guide to Setting Up Axis Atmos Client on Windows
By following these steps, you will ensure a seamless and secure experience while accessing HPE's internal network using Axis Atmos.
________________________________________
FAQ & Support
Frequently Asked Questions (FAQs): Click here to access the Axis Atmos FAQ
For further assistance, go to myITsupport and click the green Virtual Agent icon. You can also call IT support or ask questions on the #ask-myitsupport Slack channel for assistance.
`;

interface Message {
  role: string;
  content: string;
  timestamp?: number;
}

interface ResponseSection {
  sectionIndex: number;
  content: string;
}

const CompactVoiceAssistant: React.FC = () => {
  // State variables
  const [isActive, setIsActive] = useState<boolean>(false);
  const [processingText, setProcessingText] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioPaused, setIsAudioPaused] = useState<boolean>(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [kbArticle] = useState<string>(DEFAULT_KB_ARTICLE);
  const [status, setStatus] = useState<string>("Click to activate");
  const [currentResponseSections, setCurrentResponseSections] = useState<ResponseSection[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(-1);
  
  // References
  const audioStream = useRef<MediaStream | null>(null);
  const recognizer = useRef<speechsdk.SpeechRecognizer | null>(null);
  const synthesizer = useRef<speechsdk.SpeechSynthesizer | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isProcessingIntentRef = useRef<boolean>(false);
  const lastUserQueryRef = useRef<string>("");
  const needsRepeatRef = useRef<boolean>(false);

  // Setup speech services on component mount
  useEffect(() => {
    if (isActive) {
      setupSpeechServices();
    }
    
    return () => {
      cleanupSpeechServices();
    };
  }, [isActive]);

  // Clean up speech services
  const cleanupSpeechServices = async () => {
    try {
      if (recognizer.current) {
        await recognizer.current.stopContinuousRecognitionAsync();
        await recognizer.current.close();
        recognizer.current = null;
      }
      
      if (synthesizer.current) {
        synthesizer.current.close();
        synthesizer.current = null;
      }
      
      if (audioStream.current) {
        audioStream.current.getTracks().forEach(track => track.stop());
        audioStream.current = null;
      }
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  };

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
      
      // Create main speech recognizer
      recognizer.current = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
      
      // Set up speech synthesizer
      synthesizer.current = new speechsdk.SpeechSynthesizer(speechConfig);
      
      // Set up main recognizer event handlers
      recognizer.current.recognized = (s, e) => {
        if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
          const text = e.result.text.trim();
          
          if (text.length > 0) {
            // Process the input for both intents and queries
            processInput(text);
          }
        }
      };
      
      // Start continuous recognition
      await recognizer.current.startContinuousRecognitionAsync();
      
      setStatus("Listening...");
      
      console.log("Speech services initialized successfully");
    } catch (error) {
      console.error("Error setting up speech services:", error);
      setStatus("Error: Microphone access denied");
      setIsActive(false);
    }
  };

  // Process user input to determine if it's a question or a command
  const processInput = async (text: string) => {
    // Prevent multiple processing of the same input
    if (isProcessingIntentRef.current) return;
    
    isProcessingIntentRef.current = true;
    
    try {
      // First check if this is an intent to control playback
      if (isSpeaking || isAudioPaused) {
        const intentResult = await detectControlIntent(text);
        
        if (intentResult.isControlIntent) {
          handleControlIntent(intentResult.intent, intentResult.specificSection);
          isProcessingIntentRef.current = false;
          return;
        }
      }
      
      // If not a control intent and we're not currently in the middle of something else,
      // treat it as a new query
      if (!isSpeaking && !processingText) {
        lastUserQueryRef.current = text;
        handleUserQuery(text);
      }
    } catch (error) {
      console.error("Error processing input:", error);
    } finally {
      // Reset after a delay to prevent multiple quick processings
      setTimeout(() => {
        isProcessingIntentRef.current = false;
      }, 1000);
    }
  };

  // Detect if user input contains control intents
  const detectControlIntent = async (text: string): Promise<{
    isControlIntent: boolean,
    intent: string,
    specificSection: number
  }> => {
    const textLower = text.toLowerCase();
    
    // Check for simple commands first
    if (/\b(stop|pause|wait|hold on)\b/i.test(textLower)) {
      return { isControlIntent: true, intent: "stop", specificSection: -1 };
    }
    
    if (/\b(go on|continue|resume|keep going)\b/i.test(textLower)) {
      return { isControlIntent: true, intent: "continue", specificSection: -1 };
    }
    
    // Check for repeat-related intents
    const repeatRegex = /\b(repeat|say.+again|go.+back)\b/i;
    if (repeatRegex.test(textLower)) {
      // Check if they mention a specific section
      let specificSection = -1;
      
      // Look for "step X", "section X", "point X", or "number X"
      const sectionMatch = textLower.match(/\b(step|section|point|number)\s+(\d+)\b/i);
      if (sectionMatch && sectionMatch[2]) {
        specificSection = parseInt(sectionMatch[2]) - 1; // Convert to 0-based index
      } else if (textLower.includes("last step") || textLower.includes("previous step")) {
        // If they mention "last step" or "previous step"
        specificSection = currentSectionIndex > 0 ? currentSectionIndex - 1 : 0;
      }
      
      return { isControlIntent: true, intent: "repeat", specificSection };
    }
    
    // Check for more complex control phrases
    if (textLower.includes("couldn't get") || 
        textLower.includes("didn't understand") ||
        textLower.includes("missed that") ||
        textLower.includes("say that again")) {
      return { isControlIntent: true, intent: "repeat", specificSection: -1 };
    }
    
    // If no control intent detected
    return { isControlIntent: false, intent: "", specificSection: -1 };
  };

  // Handle control intents like stop, repeat, continue
  const handleControlIntent = (intent: string, specificSection: number = -1) => {
    switch (intent) {
      case "stop":
        if (isSpeaking && audioPlayer) {
          audioPlayer.pause();
          setIsAudioPaused(true);
          setStatus("Paused");
        }
        break;
        
      case "continue":
        if (isAudioPaused && audioPlayer) {
          audioPlayer.play();
          setIsAudioPaused(false);
          setStatus("Speaking...");
        }
        break;
        
      case "repeat":
        if (specificSection >= 0 && specificSection < currentResponseSections.length) {
          // Repeat a specific section
          speakResponse(currentResponseSections[specificSection].content);
          setCurrentSectionIndex(specificSection);
        } else if (audioPlayer) {
          // Just repeat the current section
          audioPlayer.currentTime = 0;
          audioPlayer.play();
          setIsAudioPaused(false);
          setStatus("Speaking...");
        } else if (needsRepeatRef.current) {
          // If we need to repeat but don't have audio ready, reprocess the last query
          needsRepeatRef.current = false;
          if (lastUserQueryRef.current) {
            handleUserQuery(lastUserQueryRef.current);
          }
        }
        break;
        
      default:
        break;
    }
  };

  // Toggle the voice assistant on/off
  const toggleAssistant = () => {
    setIsActive(!isActive);
    
    if (!isActive) {
      setStatus("Starting...");
    } else {
      setStatus("Shutting down...");
      cleanupSpeechServices();
      setStatus("Click to activate");
    }
  };

  // Split response into logical sections
  const splitIntoSections = (text: string): ResponseSection[] => {
    const sections: ResponseSection[] = [];
    
    // Split by numbered points or steps
    const numericSections = text.split(/\b(\d+\.\s+)/);
    
    if (numericSections.length > 1) {
      let currentSection = "";
      let sectionIndex = 0;
      
      for (let i = 0; i < numericSections.length; i++) {
        const part = numericSections[i];
        
        if (part.match(/^\d+\.\s+$/)) {
          // This is a section marker
          if (currentSection.trim()) {
            sections.push({
              sectionIndex,
              content: currentSection.trim()
            });
            sectionIndex++;
          }
          currentSection = part;
        } else {
          currentSection += part;
        }
      }
      
      // Add the last section
      if (currentSection.trim()) {
        sections.push({
          sectionIndex,
          content: currentSection.trim()
        });
      }
    } else {
      // No numeric sections found, split by sentences
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let currentSection = "";
      let sentenceCount = 0;
      let sectionIndex = 0;
      
      for (const sentence of sentences) {
        currentSection += sentence;
        sentenceCount++;
        
        // Group approximately 2-3 sentences per section
        if (sentenceCount >= 2) {
          sections.push({
            sectionIndex,
            content: currentSection.trim()
          });
          sectionIndex++;
          currentSection = "";
          sentenceCount = 0;
        }
      }
      
      // Add any remaining content
      if (currentSection.trim()) {
        sections.push({
          sectionIndex,
          content: currentSection.trim()
        });
      }
    }
    
    // If we somehow ended up with no sections, just use the whole text
    if (sections.length === 0) {
      sections.push({
        sectionIndex: 0,
        content: text
      });
    }
    
    return sections;
  };

  // Process user query
  const handleUserQuery = async (text: string) => {
    if (!text.trim()) return;
    
    setProcessingText(true);
    setStatus("Processing...");
    
    await processWithOpenAI(text);
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
          
          // Split the response into sections
          const sections = splitIntoSections(aiText);
          setCurrentResponseSections(sections);
          
          // Add AI response to conversation history
          const aiMessage: Message = { 
            role: 'assistant', 
            content: aiText, 
            timestamp: Date.now() 
          };
          
          setConversationHistory([...updatedHistory, aiMessage]);
          
          // Speak the first section
          if (sections.length > 0) {
            setCurrentSectionIndex(0);
            await speakResponse(sections[0].content);
          }
        } else {
          console.error('Error from server:', data.error);
          setStatus("Error: Couldn't get a response");
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
      setStatus("Error processing your request");
      setProcessingText(false);
    }
  };

  // Speak the AI response using Azure text-to-speech
  const speakResponse = async (text: string): Promise<void> => {
    if (synthesizer.current) {
      try {
        setIsSpeaking(true);
        setStatus("Speaking...");
        
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
                  // Check if there are more sections to play
                  const nextSectionIndex = currentSectionIndex + 1;
                  if (nextSectionIndex < currentResponseSections.length) {
                    // Move to next section
                    setCurrentSectionIndex(nextSectionIndex);
                    speakResponse(currentResponseSections[nextSectionIndex].content);
                  } else {
                    // All sections have been spoken
                    setIsSpeaking(false);
                    setProcessingText(false);
                    setStatus("Listening...");
                    
                    // Set this flag in case we need to repeat later
                    needsRepeatRef.current = true;
                  }
                };
                
                setAudioPlayer(audioRef.current);
                audioRef.current.play().catch(e => {
                  console.error("Error playing audio:", e);
                  setIsSpeaking(false);
                  setProcessingText(false);
                  setStatus("Error playing audio");
                });
              }
              
              // Close the temporary synthesizer
              tempSynthesizer.close();
            } else {
              console.error("Speech synthesis failed:", result.errorDetails);
              setIsSpeaking(false);
              setProcessingText(false);
              setStatus("Error creating speech");
              tempSynthesizer.close();
            }
          },
          error => {
            console.error("Speech synthesis error:", error);
            setIsSpeaking(false);
            setProcessingText(false);
            setStatus("Error creating speech");
            tempSynthesizer.close();
          }
        );
      } catch (error) {
        console.error("Error speaking response:", error);
        setIsSpeaking(false);
        setProcessingText(false);
        setStatus("Error speaking response");
      }
    } else {
      console.error("Speech synthesizer not initialized");
      setIsSpeaking(false);
      setProcessingText(false);
      setStatus("Error: Speech service not initialized");
    }
  };

  // Initialize socket connection and clean up resources when component unmounts
  useEffect(() => {
    // Socket connection setup
    socket.on("connect", () => {
      console.log("WebSocket connected with ID:", socket.id);
      if (!isActive) {
        setStatus("Click to activate");
      }
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
      if (isActive) {
        setStatus("Disconnected");
      }
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      if (isActive) {
        setStatus("Connection error");
      }
    });

    // Clean up function
    return () => {
      socket.off("voice_assistant_response");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      cleanupSpeechServices();
    };
  }, [isActive]);

  // Clean up audio URLs
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className={`compact-voice-assistant ${isActive ? 'active' : ''}`}>
      <audio ref={audioRef} style={{ display: 'none' }} />
      
      <div className="status-display">
        {status}
      </div>
      
      <div className="controls-container">
        <button 
          className={`control-button ${isActive ? 'stop-button' : 'listen-button'}`}
          onClick={toggleAssistant}
          title={isActive ? "Deactivate" : "Activate"}
        >
          <i className={`bi ${isActive ? 'bi-power' : 'bi-mic-fill'}`}></i>
        </button>
      </div>
    </div>
  );
};

export default CompactVoiceAssistant;