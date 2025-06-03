import React, { useState } from "react";
import Image from "../assets/image.png";
import Logo from "../assets/logo.png";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { useNavigate } from 'react-router-dom';
import "../css/Login.css"

//interface LoginProps {
  //onNext: () => void;
//}

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  // const [showLogin, setShowLogin] = useState(true);
  // const [showVideo, setShowVideo] = useState(false);
  // const [nextClicked, setNextClicked] = useState(false);

  // const nextPage = () => {
  //   setShowVideo(true);
  //   setShowLogin(false);
  //   setNextClicked(true);
  // }

  const navigate = useNavigate();

  const handleLogin = () => {
    // Perform login logic here
    navigate('/main/dashboard');
  };

  return (
    <div className="login-main">
      <div className="login-left">
        <img src={Image} alt="Decorative background" className="login-left-image" />
      </div>
      <div className="login-right">
        <div className="login-logo">
          <img src={Logo} alt="Logo" />
        </div>
        <div className="login-right-container">
          <h2>VOICE TRAINING</h2>
          <p>Welcome back! Please login to your account.</p>
          <form>
            <input type="text" placeholder="Username" aria-label="Username" />
            <div className="pass-input-div">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                aria-label="Password"
              />
              {showPassword ? (
                <FaEyeSlash
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Hide Password"
                />
              ) : (
                <FaEye
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Show Password"
                />
              )}
            </div>
            <div className="login-center-options">
              <div className="remember-div">
                <input type="checkbox" id="remember-checkbox" />
                <label htmlFor="remember-checkbox">
                  Remember me
                </label>
              </div>
              <a href="#" className="forgot-pass-link" id="forgot-password">
                Forgot Password
              </a>
            </div>
            <div className="login-center-buttons">
              <button type="button" className="login-button" onClick={handleLogin}>Login</button>
              <button type="button" className="signup-button">
                Sign up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
