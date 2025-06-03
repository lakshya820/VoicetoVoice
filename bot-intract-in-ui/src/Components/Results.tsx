import * as io from "socket.io-client";
import { default as React, useState, useEffect } from "react";
import Header from "./Header";
import { useNavigate } from 'react-router-dom';
import '../css/Grammar.css';
import '../css/Overlay.css';
//import socket from "./Socket";

interface GrammarCorrectionResult {
  questions: string[]
  grammarArray: string[]
  correctedGrammarArray: string[]
  total: number
}

interface SentimentAnalysisResult {
  final_csi: number
}

const Grammar: React.FC = () => {
  const [grammarCorrectionResult, setGrammarCorrectionResult] = useState<GrammarCorrectionResult | null>(null);
  const [sentimentResult, setSentimentResult] = useState<SentimentAnalysisResult | null>(null);
  

  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [opportunities, setOpportunities] = useState("");
  const [threats, setThreats] = useState("");
  const navigate = useNavigate();

    const socket = io.connect("http://localhost:8081");

    useEffect(() => {
    socket.on("grammarCorrectionResult", (data: GrammarCorrectionResult) => {
      setGrammarCorrectionResult(data);
      document.getElementById('overlay')!.style.display='none';
      console.log('grammaresult:', data);
    });
    
    socket.on("lexsentimenttofrontend", (data: SentimentAnalysisResult) => {
      setSentimentResult(data);
      console.log('sentimenTresult:', data);
    });

    socket.on("swotAnalysisResult", (data) => {
      //setSwotAnalysisResult(data);
      console.log('inSwotComponentEvent');
      console.log('swotFrontend', JSON.stringify(data, null, 2));
  
      let swot="";
      swot=data;

     // Assuming the entire SWOT content is in `data` as a single string
  const sections: string[] = swot
  .split(/(Strengths:|Weaknesses:|Opportunities:|Threats:)/) // Split by each section title
  .map((str: string) => str.trim())
  .filter((str) => str !== ""); // Remove any empty strings

  // Map section titles to their content
  const parsedData = {
      Strengths: sections[sections.indexOf("Strengths:") + 1] || "",
      Weaknesses: sections[sections.indexOf("Weaknesses:") + 1] || "",
      Opportunities: sections[sections.indexOf("Opportunities:") + 1] || "",
      Threats: sections[sections.indexOf("Threats:") + 1] || ""
  };

  // Set each section in state
  setStrengths(parsedData.Strengths);
  setWeaknesses(parsedData.Weaknesses);
  setOpportunities(parsedData.Opportunities);
  setThreats(parsedData.Threats);

  });


    
  //    return () => {
  //     socket.off("grammarCorrectionResult"); 
  //     socket.off("lexsentimenttofrontend");// Clean up the event listener
  //     socket.disconnect(); // Disconnect socket when component unmounts
  // };
}, []);

const handleSubmittoDashboard= () => {
  navigate('/swot');
  socket.emit("grammarToSwot");
};


    return (
        <React.Fragment>
            <div className="grammar">
              <Header></Header>
              {grammarCorrectionResult && (
                <div className="grammar_content">
                  <table className="grammar_table">
                    <thead>
                      <tr>
                        <th>Questions</th>
                        <th>Original Statements</th>
                        <th>Corrected Statements</th>
                      </tr>
                    </thead>
                    <tbody>
                    {grammarCorrectionResult.questions.map((question, index) => (
                  <tr key={index}>
                    <td>{question}</td>
                    <td>{grammarCorrectionResult.grammarArray[index]}</td>
                    <td>{grammarCorrectionResult.correctedGrammarArray[index]}</td>
                  </tr>
                ))}
                    </tbody>
                  </table>
                  <p>Total Correct Percentage: {grammarCorrectionResult.total.toFixed(2)}%</p>
                  <p>Final Sentiment: {sentimentResult?.final_csi !== undefined ? sentimentResult.final_csi.toFixed(2) : "N/A"}</p>
                  {/* <button className="grammar_next_button" onClick={handleSubmittoDashboard}>NEXT</button> */}
                  
                  <div className="swot">
        <div className="sw">
                                <label>Strength</label>
                                <textarea readOnly value={strengths}></textarea>
                                <label>Weaknesses</label>
                                <textarea readOnly value={weaknesses}></textarea>
                            </div>
                            <div className="ot">
                                <label>Opportuinities</label>
                                <textarea readOnly value={opportunities}></textarea>
                                <label>Threats</label>
                                <textarea readOnly value={threats}></textarea>
                            </div>
    </div>
                </div>
              )}
          </div>

          <div className='overlay' id='overlay'>
        <div className='overlay-content'>
          <div className="loader-container">
            <div className="loader">
              <div className="inner-circle"></div>
            </div>
          </div>
        </div>            
      </div>
        </React.Fragment>
    );
}

export default Grammar;