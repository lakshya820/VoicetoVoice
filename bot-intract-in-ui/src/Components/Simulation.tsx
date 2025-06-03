import '../css/Simulation.css'
import ChatBot from '../lib/ChatBot.js'
import Header from './Header';

function Simulation() {
  return (    
    <div className="App">
      <Header />
      {<ChatBot isVoiceTest={undefined} testAreaValue={undefined} />}
    </div>
  );
}

export default Simulation;