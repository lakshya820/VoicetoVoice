import React, {useState, useEffect} from "react";
//import { Container } from "react-bootstrap";

const Timer = (props) => {
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(10);
    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(true);

    useEffect(()=>{
        let interval=0;
        if(isActive && (hours>0 || minutes>0 || seconds>0)){
            interval = setInterval(()=>{
                if(seconds === 0){
                    if(minutes === 0){
                        if(hours === 0){
                            clearInterval(interval);
                            setIsActive(false);
                        }else{
                            setHours(hours -1)
                            setMinutes(59)
                            setSeconds(59)
                        }
                    }else{
                        setMinutes(minutes -1)
                        setSeconds(59)
                    }
                }else{
                    setSeconds(seconds -1)
                }
            }, 1000);
        }else{
            clearInterval(interval)
            props.onTimerStops();
        }

        return () => {
            clearInterval(interval); 
        };

    },[isActive, hours, minutes, seconds]);

    return(
        <React.Fragment>
            <container>
            <div className="timer-container">
                <div className="timer-disp">
                    <span className="timer">
                        {hours.toString().padStart(2, "0")}:
                    </span>
                    <span className="timer">
                        {minutes.toString().padStart(2, "0")}:
                    </span>
                    <span className="timer">
                        {seconds.toString().padStart(2, "0")}
                    </span>
                </div>
            </div>
            </container>
        </React.Fragment>
    );
};
export default Timer