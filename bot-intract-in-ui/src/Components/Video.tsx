import { useState, useEffect, MouseEvent } from 'react';
import VideoPlayer from './VideoPlayer';
import Header from './Header';
import { useNavigate } from 'react-router-dom';
import '../css/Video.css';

// interface VideoProps {
//   onNext: () => void;
// }

const Video: React.FC = () => {
  const [videoId, setVideoId] = useState('cdn');
  const [showNextButton, setShowNextButton] = useState(false);

  const navigate = useNavigate();

  console.log("inside video comp")

  const handleNavigateToTests1 = () => {
      navigate('/voicetest');
    };

    const  handleNavigateToDashboard = () => {
      navigate('/tests1');
    };

  useEffect(() => {
    // Call playVideo function when the component mounts
    playVideo(null, videoId);
  }, []); // Empty dependency array ensures this effect runs only once on mount

  function playVideo(e: MouseEvent<HTMLButtonElement> | null, videoId: string) {
    if (e) e.preventDefault();
    setVideoId(videoId);
    setShowNextButton(true);
  }

  return (
    <div className="video">
      <Header></Header>
      <VideoPlayer videoId={videoId} />
      <br />
      {showNextButton && 
      <div className='video_buttons'>
      <button className='video_back_button' onClick={handleNavigateToDashboard}>BACK</button>
      <button className='video_next_button' onClick={handleNavigateToTests1}>NEXT</button>
      </div>
      }
    </div>
  );
}

export default Video;
