  // NavBar.tsx
import React from 'react';
import '../css/NavBar.css';
import { useNavigate } from 'react-router-dom';

const NavBar: React.FC = () => {

  const navigate = useNavigate();

  const handleToDashboard = () => {
    // Perform login logic here
    navigate('/main/dashboard');
  };

  const handleToTests = () => {
    // Perform login logic here
    navigate('/tests1');
  };

  const handleToTranscription = () => {
    // Perform login logic here
    navigate('/transcription');
  };

  const handleToSimulation = () => {
    // Perform login logic here
    navigate('/simulation');
  };

  return (
    <div className="navbar">
      <button className="nav-button" onClick={handleToDashboard}>Dashboard</button>
      <button className="nav-button" onClick={handleToTranscription}>Pronunciation Assessment</button>
      <button className="nav-button" onClick={handleToTests}>Voice Test</button>
      <button className="nav-button" onClick={handleToSimulation}>Chat Simulation</button>
      <button className="nav-button">Settings</button>
    </div>
  );
};

export default NavBar;
