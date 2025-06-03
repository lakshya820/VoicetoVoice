import { useEffect, useState, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Stack from 'react-bootstrap/Stack';
import Table from 'react-bootstrap/Table';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';
import '../css/Transcription.css';

const API_KEY = process.env.REACT_APP_COG_SERVICE_KEY;
const API_LOCATION = process.env.REACT_APP_COG_SERVICE_LOCATION;
const STT_URL = "https://azure.microsoft.com/en-us/products/cognitive-services/speech-to-text/";

const REFERENCE_TEXTS = [
  "This is the sample sentence for pronunciation assessment.",
  "A beautiful butterfly fluttered through the cosy garden searching for sweet nectar.",
  "A talented musician practices diligently to perfect each beautiful melody."
];

interface ErrorDetail {
  word: string;
  errorType: string;
  accuracy: number;
}

interface AssessmentScores {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronunciationScore: number;
  prosodyScore: number | null;
  errors: ErrorDetail[];
}

interface AssessmentResult {
  referenceText: string;
  transcribedText: string;
  scores: AssessmentScores;
}

interface AverageScores {
  accuracy: string;
  fluency: string;
  completeness: string;
  pronunciation: string;
}

let transcriptionRecognizer: speechsdk.SpeechRecognizer | null = null;
let assessmentRecognizer: speechsdk.SpeechRecognizer | null = null;
let currentPronunciationConfig: speechsdk.PronunciationAssessmentConfig | null = null;

const Transcription: React.FC = () => {
  const [recognisedText, setRecognisedText] = useState<string>("");
  const [recognisingText, setRecognisingText] = useState<string>("");
  const [isRecognising, setIsRecognising] = useState<boolean>(false);
  const [assessmentScores, setAssessmentScores] = useState<AssessmentScores | null>(null);
  const [currentTextIndex, setCurrentTextIndex] = useState<number>(0);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [isAssessmentComplete, setIsAssessmentComplete] = useState<boolean>(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const audioStream = useRef<MediaStream | null>(null);

  // Add these state variables at the top of your component with the other state declarations
  const [isSavingToDatabase, setIsSavingToDatabase] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

  // Add this function to your component
const sendScoresToDatabase = async (scores: AverageScores): Promise<boolean> => {
  try {
    console.log("Sending scores to database:", scores);
    
    // Create the payload with the scores
    const payload = {
      accuracyScore: parseFloat(scores.accuracy),
      fluencyScore: parseFloat(scores.fluency),
      completenessScore: parseFloat(scores.completeness),
      pronunciationScore: parseFloat(scores.pronunciation)
    };
    
    // Send a POST request to your backend API
    const response = await fetch('http://localhost:8081/api/speech-scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Successfully saved speech scores to database:", data);
    return true;
  } catch (error) {
    console.error("Error saving speech scores to database:", error);
    return false;
  }
};

  const getCurrentReferenceText = (): string => REFERENCE_TEXTS[currentTextIndex];

  const startRecognizers = async (): Promise<void> => {
    try {
      if (transcriptionRecognizer && assessmentRecognizer) {
        console.log("Starting recognition for:", getCurrentReferenceText());
        await transcriptionRecognizer.startContinuousRecognitionAsync();
        await assessmentRecognizer.startContinuousRecognitionAsync();
        setIsRecognising(true);
      }
    } catch (error) {
      console.error("Error starting recognizers:", error);
    }
  };

  const clearTranscription = (): void => {
    setRecognisedText("");
    setRecognisingText("");
    setAssessmentScores(null);
  };

  // Function to navigate to dashboard
const navigateToDashboard = () => {
  window.location.href = "/main/dashboard";
};

  const stopRecognizers = async (): Promise<void> => {
    try {
      setIsRecognising(false);
      if (transcriptionRecognizer && assessmentRecognizer) {
        await transcriptionRecognizer.stopContinuousRecognitionAsync();
        await assessmentRecognizer.stopContinuousRecognitionAsync();
      }
    } catch (error) {
      console.error("Error stopping recognizers:", error);
    }
  };

  const updatePronunciationConfig = async (text: string): Promise<void> => {
    if (assessmentRecognizer) {
      console.log("Updating pronunciation config for:", text);
      currentPronunciationConfig = new speechsdk.PronunciationAssessmentConfig(
        text,
        speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
        speechsdk.PronunciationAssessmentGranularity.Word,
        true
      );
      await currentPronunciationConfig.applyTo(assessmentRecognizer);
    }
  };

  const handleStopRecording = async (): Promise<void> => {
    await stopRecognizers();
    
    if (recognisedText && assessmentScores) {
      const currentScores = {
        ...assessmentScores,
        errors: assessmentScores.errors.filter(error => {
          const currentWords = getCurrentReferenceText().toLowerCase().split(/\s+/);
          return currentWords.includes(error.word.toLowerCase());
        })
      };

      setResults(prev => [...prev, {
        referenceText: getCurrentReferenceText(),
        transcribedText: recognisedText.trim(),
        scores: currentScores
      }]);
    }

    if (currentTextIndex < REFERENCE_TEXTS.length - 1) {
      const nextIndex = currentTextIndex + 1;
      const nextText = REFERENCE_TEXTS[nextIndex];
      
      setCurrentTextIndex(nextIndex);
      setRecognisedText("");
      setAssessmentScores(null);
      setIsRecognising(false);

      setTimeout(async () => {
        if (audioStream.current) {
          console.log("Switching to new reference text:", nextText);
          await createRecognizers(audioStream.current, nextText);
        }
      }, 100);
    } else {
      // This is the final assessment, so we'll save the results
      setIsAssessmentComplete(true);

       // Need to add the current result if it exists
    const updatedResults = [...results];
    if (recognisedText && assessmentScores) {
      updatedResults.push({
        referenceText: getCurrentReferenceText(),
        transcribedText: recognisedText.trim(),
        scores: { ...assessmentScores }
      });
    }
    
    // Calculate averages and save to database
    const averages = calculateAverages(updatedResults);
    if (averages) {
      setIsSavingToDatabase(true);
      const success = await sendScoresToDatabase(averages);
      setSaveSuccess(success);
      setIsSavingToDatabase(false);
    }
    }
  };

  const handleAbort = async (): Promise<void> => {
    await stopRecognizers();
    if (recognisedText && assessmentScores) {
      setResults(prev => [...prev, {
        referenceText: getCurrentReferenceText(),
        transcribedText: recognisedText.trim(),
        scores: { ...assessmentScores }
      }]);
    }
    setIsAssessmentComplete(true);

     // Add current result if it exists
  const updatedResults = [...results];
  if (recognisedText && assessmentScores) {
    updatedResults.push({
      referenceText: getCurrentReferenceText(),
      transcribedText: recognisedText.trim(),
      scores: { ...assessmentScores }
    });
    setResults(updatedResults);
  }
  
  setIsAssessmentComplete(true);
  
  // Calculate averages and save to database if we have results
  if (updatedResults.length > 0) {
    const averages = calculateAverages(updatedResults);
    if (averages) {
      setIsSavingToDatabase(true);
      const success = await sendScoresToDatabase(averages);
      setSaveSuccess(success);
      setIsSavingToDatabase(false);
    }
  }
  };

  const toggleListener = (): void => {
    if (!isRecognising) {
      startRecognizers();
      setRecognisedText("");
      setAssessmentScores(null);
    } else {
      handleStopRecording();
    }
  };

  const openWindow = (url: string): void => {
    const top = 200;
    const left = 300;
    const height = window.innerHeight - top;
    const width = window.innerWidth - left;

    window.open(
      url, 
      '_blank', 
      `location=yes,height=${height},width=${width},top=${top},left=${left},scrollbars=yes,status=yes`
    );
  };

  const createRecognizers = async (stream: MediaStream, referenceText?: string | null): Promise<void> => {
    try {
      if (transcriptionRecognizer) {
        await transcriptionRecognizer.close();
      }
      if (assessmentRecognizer) {
        await assessmentRecognizer.close();
      }

      const audioConfig = speechsdk.AudioConfig.fromStreamInput(stream);
      const currentText = referenceText || REFERENCE_TEXTS[currentTextIndex];

      console.log("Creating recognizers for reference text:", currentText);

      const transcriptConfig = speechsdk.SpeechConfig.fromSubscription(API_KEY!, API_LOCATION!);
      transcriptConfig.speechRecognitionLanguage = "en-US";

      const assessConfig = speechsdk.SpeechConfig.fromSubscription(API_KEY!, API_LOCATION!);
      assessConfig.speechRecognitionLanguage = "en-US";

      transcriptionRecognizer = new speechsdk.SpeechRecognizer(transcriptConfig, audioConfig);
      assessmentRecognizer = new speechsdk.SpeechRecognizer(assessConfig, audioConfig);

      currentPronunciationConfig = new speechsdk.PronunciationAssessmentConfig(
        currentText,
        speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
        speechsdk.PronunciationAssessmentGranularity.Word,
        true
      );
      await currentPronunciationConfig.applyTo(assessmentRecognizer);

      console.log("Created assessment config for:", currentText);

      transcriptionRecognizer.recognizing = (s, e) => {
        setRecognisingText(e.result.text);
        if (textRef.current) {
          textRef.current.scrollTop = textRef.current.scrollHeight;
        }
      };

      transcriptionRecognizer.recognized = (s, e) => {
        setRecognisingText("");
        if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
          setRecognisedText(prev => prev === '' ? e.result.text : `${prev} ${e.result.text}`);
          if (textRef.current) {
            textRef.current.scrollTop = textRef.current.scrollHeight;
          }
        }
      };

      assessmentRecognizer.recognized = (s, e) => {
        if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
          try {
            const pronunciationResult = speechsdk.PronunciationAssessmentResult.fromResult(e.result);
            console.log("Full pronunciation result:", pronunciationResult);
      
            const referenceWords = currentText.toLowerCase().split(/\s+/);
            const spokenWords = e.result.text.toLowerCase().split(/\s+/);
      
            const missingWordsCount = referenceWords.filter(word => 
              !spokenWords.includes(word)
            ).length;
      
            const completenessScore = Math.max(
              0, 
              (pronunciationResult.completenessScore * (referenceWords.length - missingWordsCount) / referenceWords.length)
            );
      
            const accuracyScore = Math.max(
              0,
              pronunciationResult.accuracyScore * (1 - (missingWordsCount / referenceWords.length))
            );
      
            let errors: ErrorDetail[] = [];
      
            // Filter out "None" errors and only include actual errors
            if (pronunciationResult.detailResult?.Words) {
              const mispronunciationErrors = pronunciationResult.detailResult.Words
                .filter(word => word && word.Word)
                .filter(word => {
                  // Only include words with actual error types (not "None") or very low accuracy
                  const errorType = word.PronunciationAssessment?.ErrorType || '';
                  const accuracy = word.PronunciationAssessment?.AccuracyScore || 0;
                  return (errorType !== '' && errorType !== 'None') || accuracy < 99;
                })
                .map(word => ({
                  word: word.Word,
                  errorType: word.PronunciationAssessment?.ErrorType || 'Mispronunciation',
                  accuracy: word.PronunciationAssessment?.AccuracyScore || 0
                }));
      
              errors.push(...mispronunciationErrors);
            }
      
            // Add omission errors
            referenceWords.forEach(word => {
              if (!spokenWords.includes(word)) {
                errors.push({
                  word: word,
                  errorType: "Omission",
                  accuracy: 0
                });
              }
            });
      
            const scores: AssessmentScores = {
              accuracyScore: parseFloat(accuracyScore.toFixed(2)),
              fluencyScore: pronunciationResult.fluencyScore,
              completenessScore: parseFloat(completenessScore.toFixed(2)),
              pronunciationScore: pronunciationResult.pronunciationScore,
              prosodyScore: pronunciationResult.prosodyScore || null,
              errors: errors
            };
      
            console.log("Setting assessment scores:", scores);
            setAssessmentScores(scores);
          } catch (error) {
            console.error("Error processing pronunciation result:", error);
          }
        }
      };

      const handleError = (recognizer: speechsdk.SpeechRecognizer, e: speechsdk.CancellationEventArgs) => {
        console.error(`Recognition canceled:`, {
          reason: e.reason,
          errorCode: e.errorCode,
          errorDetails: e.errorDetails
        });
        recognizer.stopContinuousRecognitionAsync();
      };

      transcriptionRecognizer.canceled = (s, e) => handleError(transcriptionRecognizer!, e);
      assessmentRecognizer.canceled = (s, e) => handleError(assessmentRecognizer!, e);

      console.log("Successfully created recognizers");
    } catch (error) {
      console.error("Error creating recognizers:", error);
      throw error;
    }
  };

  const calculateAverages = (results: AssessmentResult[]): AverageScores | null => {
    if (!results.length) return null;
    
    const totals = results.reduce((acc, result) => {
      return {
        accuracy: acc.accuracy + result.scores.accuracyScore,
        fluency: acc.fluency + result.scores.fluencyScore,
        completeness: acc.completeness + result.scores.completenessScore,
        pronunciation: acc.pronunciation + result.scores.pronunciationScore
      };
    }, { accuracy: 0, fluency: 0, completeness: 0, pronunciation: 0 });

    return {
      accuracy: (totals.accuracy / results.length).toFixed(2),
      fluency: (totals.fluency / results.length).toFixed(2),
      completeness: (totals.completeness / results.length).toFixed(2),
      pronunciation: (totals.pronunciation / results.length).toFixed(2)
    };
  };

  useEffect(() => {
    const getMedia = async () => {
      try {
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
        await createRecognizers(stream);
      } catch (err) {
        console.error("Error accessing media devices:", err);
        alert("Error accessing microphone: " + (err as Error).message);
      }
    };

    getMedia();

    return () => {
      const cleanup = async () => {
        try {
          if (transcriptionRecognizer) {
            await transcriptionRecognizer.close();
          }
          if (assessmentRecognizer) {
            await assessmentRecognizer.close();
          }
        } catch (error) {
          console.error("Error during cleanup:", error);
        }
      };
      cleanup();
    };
  }, []);

  return (
    <div className="app-container">
      {!isAssessmentComplete ? (
        <div className="assessment-container">
          <div className="textarea-container">
            <div className="question-text">Reference Text ({currentTextIndex + 1} of {REFERENCE_TEXTS.length})</div>
            <Form.Control
              as="textarea"
              value={getCurrentReferenceText()}
              readOnly
              className="reference-textarea"
            />
            
            <div className="question-text mt-4">Your Speech</div>
            <Form.Control
              as="textarea"
              placeholder="The transcription will go here"
              value={`${recognisedText}${recognisingText}`}
              readOnly
              className="speech-textarea"
              ref={textRef}
            />
            
            <p className="instructions-text">
              Important Instructions: Please take 30-40 seconds to frame your answer and then try answering in one go without any unnecessary pauses.
            </p>

            <div className="button-container">
              <Button 
                variant={isRecognising ? "secondary" : "primary"}
                onClick={toggleListener}
                className="action-button">
                {isRecognising ? 'Stop' : 'Start'}
              </Button>
              <Button 
                variant="secondary" 
                onClick={clearTranscription}
                className="action-button">
                Clear
              </Button>
              <Button 
                variant="warning" 
                onClick={handleAbort}
                className="action-button">
                Abort Assessment
              </Button>
            </div>

            <div className="note-text">
              Using Microsoft <a href="#" onClick={() => openWindow(STT_URL)} className="link-text">
                Azure Speech to Text
              </a> for Real Time Transcription and Pronunciation Assessment
            </div>
          </div>
        </div>
      ) : (
        <div className="results-container">
          <h4 className="results-title">Assessment Results</h4>

          {results.length > 0 && (
            <div className="cumulative-results">
              <h5>Your Overall Result:</h5>
              <div className="scores-container">
                {(() => {
                  const averages = calculateAverages(results);
                  return averages ? (
                    <>
                      <p className="score-item">Fluency: {averages.fluency}</p>
                      <p className="score-item">Completeness: {averages.completeness}</p>
                      <p className="score-item">Pronunciation: {averages.pronunciation}</p>
                    </>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Reference Text</th>
                <th>Your Speech</th>
                <th>Scores</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={index}>
                  <td>{result.referenceText}</td>
                  <td>{result.transcribedText}</td>
                  <td>
                    <div className="scores-container">
                      <p className="score-item">Fluency: {result.scores?.fluencyScore.toFixed(2)}</p>
                      <p className="score-item">Completeness: {result.scores?.completenessScore.toFixed(2)}</p>
                      <p className="score-item">Pronunciation: {result.scores?.pronunciationScore.toFixed(2)}</p>

                      {result.scores?.errors?.length > 0 ? (
  <div className="errors-container">
    <p className="errors-title">Pronunciation Errors Found:</p>
    {(() => {
      // Group errors by type, but filter out "None" errors
      const errorsByType = result.scores.errors
        .filter(error => error.errorType !== 'None') // Extra safety check
        .reduce((acc, error) => {
          // Use more descriptive error type labels
          let displayType = error.errorType;
          
          // If needed, map technical error types to more user-friendly descriptions
          if (displayType === '') {
            displayType = 'Mispronunciation';
          }
          
          if (!acc[displayType]) {
            acc[displayType] = [];
          }
          
          // Only add each word once per error type
          if (!acc[displayType].includes(error.word)) {
            acc[displayType].push(error.word);
          }
          
          return acc;
        }, {} as Record<string, string[]>);

      // Only render if we have actual errors to show
      if (Object.keys(errorsByType).length === 0) {
        return <p className="no-errors">No significant pronunciation errors detected</p>;
      }

      return Object.entries(errorsByType).map(([errorType, words]) => (
        <div key={errorType} className="error-group">
          <span className="error-type">{errorType} errors: </span>
          <span className="error-words">
            {words.join(', ')}
          </span>
        </div>
      ));
    })()}
  </div>
) : (
  <p className="no-errors">No pronunciation errors detected</p>
)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="home-button-container">
  <button 
    onClick={navigateToDashboard}
    className="home-button">
    Return to Dashboard
  </button>
</div>
        </div>
      )}
    </div>
  )}

  export default Transcription