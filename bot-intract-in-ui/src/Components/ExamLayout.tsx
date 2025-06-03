// Header.tsx
import { default as React, useEffect} from "react";
import '../css/Header.css';
import '../css/NavBar.css';
import '../css/QuestionMain.css'
//import '../css/Grammar.css'
import '../css/Overlay.css'
import Timer from "../lib/test-timer";
import Header from './Header';


interface MainLayoutProps{
  children: React.ReactNode; // To render other components inside MainLayout
}

const ExamLayout: React.FC<MainLayoutProps> = ({children}) => {
  let disable_timer=false;
  let disable_visiblity = false;
  sessionStorage.setItem('first_exam_warning', "false");
  let exam_start=false;



  useEffect(() => {
   
    //window.onload = () => {  document.getElementById('warning')!.style.display='none'};
document.getElementById('warning')!.style.display='none'
    console.log("inside useEffect");
    const overlayElement = document.getElementById('overlay');
    console.log("overlay element: ",overlayElement);
    if (overlayElement) {
      overlayElement.style.display = "block";
      sessionStorage.setItem('first_page_load', "true");
    }
    document.getElementById('test_end_message')!.style.display="none";
  }, []);

  function stop_exam(status:any){
    document.getElementById('tst_pnl')?.remove();
    if(status=="timer"){
      disable_visiblity=true;
      document.getElementById('exam-pnl')!.innerHTML = `<div style=' background-color: #F4F5F8; height: 100vh; width: 100vw; border-radius: 15px; text-align: center; padding-top: 115px;'>
                                                          <div style='text-align: inherit; font-weight: 600; font-size: 24px; padding-top: 100px;'>
                                                            <span>Your time is over.</span>
                                                          </div>
                                                          <div style='padding-top:inherit;'>
                                                            <span><button onClick="(function(){document.exitFullscreen();})();return false;" style='width: 10rem; border-radius: 7px; height: 2.2rem; border: none; background-color: #5F249F; color: #ffff; margin-right:5px;'>Close</button></span>
                                                          </div>
                                                        </div>`;
 
    }else{
      disable_timer=true;
      document.getElementById('exam-pnl')!.innerHTML =  `<div style=' background-color: #F4F5F8; height: 100vh; width: 100vw; border-radius: 15px; text-align: center; padding-top: 115px;'>
                                                          <div style='text-align: inherit; font-weight: 600; font-size: 24px; padding-top: 100px;'>
                                                            <span>You were warned once, but since you continued to exit full-screen or changed tabs, the exam has been terminated.</span>
                                                          </div>
                                                          <div style='padding-top:inherit;'>
                                                            <span><button onClick="(function(){document.exitFullscreen();})();return false;" style='width: 10rem; border-radius: 7px; height: 2.2rem; border: none; background-color: #5F249F; color: #ffff; margin-right:5px;'>Close</button></span>
                                                          </div>
                                                        </div>`;
    }
   
 
  }


  const handleOnTimerStops = () => {
    if(!disable_timer){      
      stop_exam("timer");
    }
  };

  // document.onvisibilitychange=()=>{
  //   if(!disable_visiblity && exam_start){
  //     if (document.visibilityState === 'hidden'){
  //       if(sessionStorage.getItem('first_exam_warning')?.toLowerCase()==="true"){
  //         stop_exam("intruption");
  //       }else{
  //         document.getElementById('warning')!.style.display="block";
  //       }
  //     }
  //   }
  // };
 
  // document.addEventListener('fullscreenchange', () => {
  //   if(!disable_visiblity && exam_start){
  //     if (document.fullscreenElement == null) {
  //       if(sessionStorage.getItem('first_exam_warning')?.toLowerCase()==="true"){
  //         stop_exam("intruption");
  //       }else{
  //         document.getElementById('warning')!.style.display="block";
  //       }
  //     }
  //   }
  // });
 
  const handleStartExam=()=>{
    document.documentElement.requestFullscreen();
    document.getElementById('overlay')!.style.display="none";
    document.getElementById('start_timer')?.click();
    document.getElementById('start_timer')?.remove();
    exam_start=true;
    //document.getElementById('audio')!.autoplay=true;
    const audioElement = document.getElementById('audio') as HTMLAudioElement;
    audioElement.play();
    sessionStorage.setItem('first_page_load', 'false');
    console.log("in examlayout:", sessionStorage.getItem('first_page_load'));
  }
 
  const handleResumeExam=()=>{
    document.documentElement.requestFullscreen();
    document.getElementById('warning')!.style.display="none";    
    sessionStorage.setItem('first_exam_warning', "true");
    const audioElement = document.getElementById('audio') as HTMLAudioElement;
    audioElement.play();   
  };

  // function show_score(){
  //   return "80%";
  // }
  

  return (
    <div id="start_div">
     <div className='overlay' id='overlay'>
        <div className='overlay-content'>
          <div className='overlay-elem'>
            <div className="overlay_div">
              <p>To begin the exam, click on the 'OK' button.</p>
              <p>This action will automatically switch your browser to full-screen mode.</p>
              <br></br>
              <p>Please note that if you attempt to exit full-screen mode or switch tabs during the exam, you will receive a warning on your first attempt.</p>
              <p>If you do so a second time, your exam will be terminated, and all your progress will be lost.</p>
              <button className='overlay_button' onClick={handleStartExam}>OK</button>
           </div>
          </div>
          <div className='overlay-elem'>
            
            </div>
        </div>            
      </div>

      <div className='overlay' id='warning'>
        <div className='overlay-content'>
          <div className='overlay-elem'>
            <div className="overlay_div">
              <p>Warning: Exiting full screen or switching tabs will result in the termination of the exam, and all progress will be lost.</p>
              <button className='overlay_button' onClick={handleResumeExam}>OK</button></div>
            </div>
          </div>
          <div className='overlay-elem'>
            
        </div>            
      </div>
      <div className='exam-pnl' id="exam-pnl"></div>  
      <Header />
      <div className="exam" id='tst_pnl'>    
        <div className="exam_end" id="test_end_message">
          <p>Thank you for completing the test. Your responses have been successfully recorded.</p>
        </div>      

        <div className="exam_content" id="exam_content">   
              <div className="exam_card">
              <div className="exam_card_header">
                <div className='exam-timer'>Timer:&nbsp;
                  <span id='timer'><Timer onTimerStops={handleOnTimerStops}/></span>
                </div>           
                <p>Grammar Test</p>
                
              </div>
              {/* <audio id="audio" autoPlay></audio> */}
              {children}
              </div>
            
        </div>
      </div>
    </div>    
  );
};
export default ExamLayout