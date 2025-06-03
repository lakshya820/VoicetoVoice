import { default as React } from "react";
import '../css/Tests1.css';
import { useNavigate } from 'react-router-dom';
import Header from "./Header";

  


const Tests1: React.FC = () => {

    const navigate = useNavigate();

    const handleNavigateToVoicetest = () => {
        navigate('/video');
      };

      // Function to navigate to dashboard
const navigateToDashboard = () => {
  window.location.href = "/main/dashboard";
};


  return (
    <div className="tests1">
      <Header></Header>
                <div className="tests1_header">
                    <h1>Tests</h1>
                </div>
                <div className="tests1_card">
                    <div className="card_header">
                    <p>Effective Communication Test</p>
                    </div>
                    <div className="card_label1">
                            <p>This test will assess participants' spoken and written responses for accuracy in tense use, subject-verb agreement, sentence structure, punctuation, and coherence. The focus is on evaluating their ability to construct clear and grammatically correct sentences in real-time.</p>
                    </div>
                    <div className="card_label2">
                            <p>Duration: 10 mins</p>
                    </div>
                    <div className="card_buttons">
                            <button className="card_button_start" onClick={handleNavigateToVoicetest}>Start Test</button>
                            <button className="card_button_cancel" onClick={navigateToDashboard}>Cancel</button>
                    </div>
                </div>
    </div>
  )
}

export default Tests1;