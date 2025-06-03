import {default as React, useState, useEffect} from "react";
import VoiceTest from "./Components/VoiceTest";
import Timer from "./lib/test-timer";
//import Container from "react-bootstrap/Container";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Tests1 from './Components/Tests1';
import Grammar from "./Components/Grammar";
import MainLayout from "./Components/MainLayout";
import Dashboard2 from "./Components/Dashboard2";
import Login from "./Components/Login";
import Video from "./Components/Video";
//import SWOT from "./Components/SWOT";
import Transcription from "./Components/Transcription";
import Simulation from "./Components/Simulation";
import VoiceAssistant from "./Components/VoiceAssistant";
import ITSupportDemo from "./Components/ITSupportDemo";

function App() {
  //Get parametes from URL
  const params = window.location.href.replace("http://localhost:8081/", "").split("/");
  console.log(params);

  try{
    let stateCheck = setInterval(() => {
      if (document.readyState === 'complete') {
        //console.log("checked document is fully loaded in Front end.")
        clearInterval(stateCheck);
        
        //console.log("page is fully loaded");
        document.getElementById('start_conv')?.click();
      }
    }, 100);
  }catch(error){
    console.log("Error form App.tsx file: "+error)
  } 

  // const handleOnTimerStops = () => {
  //   console.log("Timer stops.");
  //   window.location.href = '/test-complete.html'
  // };
  
  // if(params[0]=="voice"){
  //   console.log("Voice part executed.");
  return (
    <Router>
    <Routes>
      <Route path="/" element={<ITSupportDemo />} />
      <Route path="/voicetest" element={<VoiceTest />} />
      <Route path="/grammar" element={<Grammar />} />
      <Route path="/video" element={<Video />} />
      <Route path="/tests1" element={<Tests1 />} />
      <Route path="/simulation" element={<Simulation />} />
      {/* <Route path="/swot" element={<SWOT />} /> */}
      <Route path="/transcription" element={<Transcription />} />
      <Route path="/main" element={<MainLayout />}>
        <Route path="dashboard" element={<Dashboard2 />} />
      </Route>
    </Routes>
  </Router>
  ); 
  // }else{
  //   console.log("Type part executed.");
  //   return (
  //     <ExamLayout>
  //       <TypeTest />
  //     </ExamLayout>      
  //   ); 
  // }
}

export default App;
