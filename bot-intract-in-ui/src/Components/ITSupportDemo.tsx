import React from 'react';
import CompactVoiceAssistant from './CompactVoiceAssistant';
import myITSupportImage from '../assets/myITsupport.png';
import '../css/ITSupportDemo.css';

const ITSupportDemo: React.FC = () => {
  return (
    <div className="support-page-container">
      <div className="support-page-background">
        <div className="support-content">
          <img src={myITSupportImage} alt="IT Support Background" />
        </div>
        
        {/* The compact voice assistant is positioned in the bottom right */}
        <CompactVoiceAssistant />
      </div>
    </div>
  );
};

export default ITSupportDemo;