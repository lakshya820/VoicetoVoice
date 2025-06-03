import React, { useRef, useEffect, RefObject } from 'react';

interface VideoPlayerProps {
  videoId: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId }) => {
  const videoRef: RefObject<HTMLVideoElement> = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, [videoId]); // Adding videoId as a dependency to re-run the effect when videoId changes

  return (
    <video ref={videoRef} width="1200" height="700" controls autoPlay>
      <source src={`http://localhost:8081/videos/${videoId}`} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  );
};

export default VideoPlayer;
