import { default as React, useState, useEffect } from "react";
import '../css/Dashboard2.css';
import { useNavigate } from "react-router-dom";

// Define interfaces for our data types
interface AnalysisResult {
  id: number;
  sentiment_score: {
    final_csi: number;
  };
  grammar_result: {
    total: number;
  };
  swot_analysis: string;
  created_at: string;
}

interface ChatbotScore {
  id: number;
  average_handle_time: string;
  average_response_time: number;
  average_type_speed: number;
  csi_score: number;
  created_at: string;
}

interface SpeechScore {
  id: number;
  fluency_score: number;
  completeness_score: number;
  pronunciation_score: number;
  created_at: string;
}

const Dashboard2: React.FC = () => {
  // Set up state for our data
  const [latestResult, setLatestResult] = useState<AnalysisResult | null>(null);
  const [latestChatbotScore, setLatestChatbotScore] = useState<ChatbotScore | null>(null);
  const [latestSpeechScore, setLatestSpeechScore] = useState<SpeechScore | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
   
  const navigate = useNavigate();
  
  // Helper function to format numbers
  const formatNumber = (value: any, decimals: number = 2) => {
    if (value === null || value === undefined) return 'N/A';
    
    try {
      const num = typeof value === 'number' ? value : parseFloat(value);
      return num.toFixed(decimals);
    } catch (e) {
      console.error("Error formatting number:", e);
      return 'N/A';
    }
  };
  
  // Function to fetch the latest data from all tables
  const fetchLatestData = async () => {
    setLoading(true);
    try {
      // Fetch latest analysis result
      const analysisResponse = await fetch('http://localhost:8081/api/latest-analysis-result');
      if (!analysisResponse.ok) {
        throw new Error(`HTTP error! status: ${analysisResponse.status}`);
      }
      const analysisData = await analysisResponse.json();
      setLatestResult(analysisData.result || null);
      
      // Fetch latest chatbot score
      const chatbotResponse = await fetch('http://localhost:8081/api/latest-chatbot-score');
      if (!chatbotResponse.ok) {
        throw new Error(`HTTP error! status: ${chatbotResponse.status}`);
      }
      const chatbotData = await chatbotResponse.json();
      setLatestChatbotScore(chatbotData.result || null);
      
      // Fetch latest speech score
      const speechResponse = await fetch('http://localhost:8081/api/latest-speech-score');
      if (!speechResponse.ok) {
        throw new Error(`HTTP error! status: ${speechResponse.status}`);
      }
      const speechData = await speechResponse.json();
      setLatestSpeechScore(speechData.result || null);
      
      setError(null);
    } catch (err) {
      console.error("Error fetching latest data:", err);
      setError("Failed to load latest assessment data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };
  
  // Load data when the component mounts
  useEffect(() => {
    fetchLatestData();
  }, []);

  // Format date from ISO string
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
   
  return (
    <React.Fragment>
      <div className="dashboard">
        <div className="dashboard_header">
          <p>Dashboard</p>
          <button 
            className="refresh-button" 
            onClick={fetchLatestData}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
        
        {loading ? (
          <div className="loading">Loading latest results...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            {/* Grammar Analysis Results Section */}
            <div className="section-header">
              <h3>Voice Analysis</h3>
            </div>
            
            {latestResult ? (
              <div className="result-stats-container">
                <div className="result-stat-box">
                  <div className="stat-label">Grammar Score</div>
                  <div className="stat-value">{latestResult.grammar_result?.total || 'N/A'}</div>
                </div>
                <div className="result-stat-box">
                  <div className="stat-label">Sentiment Score</div>
                  <div className="stat-value">{formatNumber(latestResult.sentiment_score?.final_csi, 2)}</div>
                </div>
                <div className="result-stat-box">
                  <div className="stat-label">Test Date</div>
                  <div className="stat-value">{formatDate(latestResult.created_at)}</div>
                </div>
              </div>
            ) : (
              <div className="no-data">
                <p>No grammar analysis results found.</p>
              </div>
            )}
            
            {/* Chatbot Scores Section */}
            <div className="section-header">
              <h3>Chat Analysis</h3>
            </div>
            
            {latestChatbotScore ? (
              <div className="result-stats-container">
                <div className="result-stat-box">
                  <div className="stat-label">Avg. Handle Time</div>
                  <div className="stat-value">{latestChatbotScore.average_handle_time || 'N/A'}</div>
                </div>
                <div className="result-stat-box">
                  <div className="stat-label">Avg. Response Time</div>
                  <div className="stat-value">{formatNumber(latestChatbotScore.average_response_time, 1)} sec</div>
                </div>
                <div className="result-stat-box">
                  <div className="stat-label">Avg. Type Speed</div>
                  <div className="stat-value">{formatNumber(latestChatbotScore.average_type_speed, 1)} wpm</div>
                </div>
                <div className="result-stat-box">
                  <div className="stat-label">Sentiment Score</div>
                  <div className="stat-value">{formatNumber(latestChatbotScore.csi_score, 2)}</div>
                </div>
                <div className="result-stat-box">
                  <div className="stat-label">Test Date</div>
                  <div className="stat-value">{formatDate(latestChatbotScore.created_at)}</div>
                </div>
              </div>
            ) : (
              <div className="no-data">
                <p>No chatbot simulation results found.</p>
              </div>
            )}
            
            {/* Speech Assessment Scores Section */}
            <div className="section-header">
              <h3>Pronunciation Analysis</h3>
            </div>
            
            {latestSpeechScore ? (
              <div className="result-stats-container">
                <div className="result-stat-box">
                  <div className="stat-label">Fluency Score</div>
                  <div className="stat-value">{formatNumber(latestSpeechScore.fluency_score, 2)}</div>
                </div>
                <div className="result-stat-box">
                  <div className="stat-label">Completeness Score</div>
                  <div className="stat-value">{formatNumber(latestSpeechScore.completeness_score, 2)}</div>
                </div>
                <div className="result-stat-box">
                  <div className="stat-label">Pronunciation Score</div>
                  <div className="stat-value">{formatNumber(latestSpeechScore.pronunciation_score, 2)}</div>
                </div>
                <div className="result-stat-box">
                  <div className="stat-label">Test Date</div>
                  <div className="stat-value">{formatDate(latestSpeechScore.created_at)}</div>
                </div>
              </div>
            ) : (
              <div className="no-data">
                <p>No speech assessment results found.</p>
              </div>
            )}
            
            {/* SWOT Analysis Section */}
            <div className="section-header">
              <h3>SWOT Analysis</h3>
            </div>
            
            {latestResult && latestResult.swot_analysis ? (
              <div className="swot-analysis-container">
                <pre className="swot-analysis">{latestResult.swot_analysis}</pre>
              </div>
            ) : (
              <div className="no-data">
                <p>No SWOT analysis available.</p>
              </div>
            )}
          </>
        )}
      </div>
    </React.Fragment>
  );
}

export default Dashboard2;