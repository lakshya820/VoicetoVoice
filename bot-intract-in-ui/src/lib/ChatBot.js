import React, { useState, useEffect, useRef } from 'react';
import AWS from 'aws-sdk';
import '../css/Simulation.css'

const api_url = 'https://api.openai.com/v1/chat/completions';
const api_method = 'POST';
const api_content_type = 'application/json';
const api_auth_key = "Bearer "+process.env.REACT_APP_OPENAI_API_KEY;
const api_model = 'gpt-4o-mini';

let initial_execution = true;
var is_closing = false;

// Add this variable outside your component, at the module level
let hasSavedToDB = false;

AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_LEX_CLIENTID,
  secretAccessKey: process.env.REACT_APP_AWS_LEX_SECRETKEY,
  region: process.env.REACT_APP_AWS_LEX_REGION
});

const comprehend = new AWS.Comprehend();

//Troubleshooting steps for Gmail
var pdf_content = `Content:"Open a web browser (e.g., Chrome, Firefox, Safari) and visit the Gmail signup page: https://accounts.google.co.in/. Enter your first name and last name in the designated fields. Create a unique username, which will become your email address (e.g., yourname@gmail.com). If your preferred username is already taken, Gmail will suggest alternatives. Choose a strong password that combines uppercase and lowercase letters, numbers, and symbols for security, and confirm it by entering it again.

Click "Next" to proceed. Provide a valid phone number for account verification. Google will send a verification code via text or call. Enter the code in the provided field to verify your phone number. Optionally, add a recovery email address to help recover your account if you forget your password. Enter your date of birth and select your gender.

Read through Google's Terms of Service and Privacy Policy, then click "I agree" to accept them. Once you've completed the steps, your Gmail account will be created. You can now log in to Gmail and start using your new email account.

For easy access, download the Gmail app on your smartphone or tablet from the Google Play Store (for Android) or the App Store (for iOS). Log in using your new account credentials. You're all set to send, receive, and organize your emails with Gmail!"`

const ChatBot = ({isVoiceTest, testAreaValue}) => {
  if(isVoiceTest){
    document.getElementById("txt_msg")?.setAttribute("disabled", "disabled");
  }
  const [input, setInput] = useState('');
  const [AverageHandleTime, setAvarageHandleTime] = useState('');
  const [AverageResponseTime, setAverageResponseTime] = useState('');
  const [messages, setMessages] = useState([]);
  const [typeSpeed, setTypeSpeed] = useState([]);
  const [averageTypeSpeed, setAverageTypeSpeed] = useState([]);
  const [averageSentimentScore, setAverageSentimentScore] = useState([]);
  const [startTypeTime, setStartTypeTime] = useState('');
  const [isTextAreaDisabled, setIsTextAreaDisabled] = useState(false);
  const [isStartTypeing, setIsStartTypeing] = useState(false);
  const msgDivRef = useRef(true);
  const txtArea = useRef();

  const [prompt, setPrompt] = useState(` 
    Scenario:
    I (the user) will act as a service representative assisting you (the AI) in creating your Gmail account.

    Instructions for the AI:

    1. Refrain from generic responses:
    Do not respond to the generic phrases like "ok," "sure," "got it," "makes sense," "I see," "understood," "interesting," "alright," "noted," or "thanks for sharing." Instead, rephrase the last question from the service representative's side.

    2. Do not assist with solutions:
    Avoid offering any solutions, instructions, or assistance related to the content on your side. 
    Focus on the specific actions and instructions given by the service representative.
    Do not respond to those question whose answer or solution is related or based on the content.

    3. Increase frustration with repeated questions:
    If the service representative repeats a question, the AI should respond with increasing frustration while maintaining a confident tone.

    4. Act as an assertive customer:
    The AI should simulate an assertive customer who is having difficulty, keeping responses concise and direct.

    5. Share necessary personal information:
    Provide any necessary personal information when prompted by the service representative. Ensure you give the correct instructions or actions when required.

    6. Avoid unnecessary explanations:
    Keep responses focused on what’s needed, without adding excessive details or explanations.

    7. Conclude the conversation efficiently:
    Once the Gmail account is successfully created, the AI should ensure the issue is resolved and then close the conversation.
    `);

      // Add this function to your component - notice we now pass direct values
  const sendChatBotScoresToDatabase = (handleTime, responseTime, typeSpeed, csiScore) => {
    // Check if we've already saved to prevent duplicate calls
    if (hasSavedToDB) {
      console.log("Database save already performed, skipping duplicate save");
      return;
    }

    // Set the flag immediately to prevent any other calls
    hasSavedToDB = true;
    
    // Create the payload with the direct values passed to this function
    const payload = {
      averageHandleTime: handleTime,
      averageResponseTime: parseFloat(responseTime || 0),
      averageTypeSpeed: parseFloat(typeSpeed || 0),
      csiScore: parseFloat(csiScore || 0)
    };
    
    console.log("Sending ChatBot scores to database:", payload);
    
    // Send a POST request to your backend API
    fetch('http://localhost:8081/api/chatbot-scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => console.log("Database save result:", data))
    .catch(error => console.error("Error saving to database:", error));
  };

   // Function to navigate to dashboard
const navigateToDashboard = () => {
  window.location.href = "/main/dashboard";
};


  const checkForClosure = async () =>{
    const userMessage = { role: 'system', content: "Did this chat reached to a conclusion or resolution state? Respond only in Yes/No." };
    try {
      // Use the fetch API to send a request to OpenAI
      const response = await fetch(api_url, {
        method: api_method,
        headers: {'Content-Type': api_content_type, Authorization: api_auth_key,
        },
        body: JSON.stringify({
          model: api_model,
          messages: [...messages, userMessage],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Add the bot's response to the chat
        //console.log("checkForClosure response: ", data.choices[0].message.content)
        return data.choices[0].message.content;
      } else {
        console.error('Error:', data);
        return "error";
      }
    } catch (error) {
      console.error('Error communicating with OpenAI API:', error);
    }
  }

  const sendMessage = async () => {
    setIsTextAreaDisabled(true);
    if(input.trim()!="" || initial_execution){
      let textAreaInput = input;
      setInput(''); 
      //calculate the typing speed per second for each user response
      if(startTypeTime!=''){
        let current_time = new Date();
        //console.log('current time: ', current_time, "start time:", startTypeTime)
        let time_diff = current_time - startTypeTime;
        //console.log('time diffrence: ', time_diff, 'in secs: ',time_diff/1000, "in min: ",(time_diff/60000));
        let word_count = input.trim().split(' ').length;
        //console.log('word_count: ', word_count)
        let words_per_sec = (word_count/(time_diff/60000)).toFixed(1);
        //console.log('words_per_sec: ', words_per_sec)
        setTypeSpeed((oldRec)=>[...oldRec, words_per_sec])
      }    

      const sysMessage = { role: 'system', content: pdf_content + prompt};
      //console.log("is_closing: ", is_closing);

      //console.log("message length: ",messages.length)
      let userMessage = {};
      if(messages.length==0){
        userMessage = { role: 'user', content: "How can I help you?", timestamp:Date.now() };
      }else{
        if (textAreaInput.trim() === '') return;

        if(messages.length > 0){
          var closure_resonse = ""+await checkForClosure()
          //console.log('closure_resonse: ', closure_resonse);
          if(closure_resonse.replace('.','').toLowerCase() == 'yes'){
            //console.log('inside if');
            is_closing = true;
          }
        }
        
        userMessage = { role: 'user', content: textAreaInput, timestamp:Date.now() };
        setMessages([...messages, userMessage]);
      }

      //console.log("messages before open ai call: ", [...messages, sysMessage, userMessage])
      setTimeout(async () => {
        try {
          // Use the fetch API to send a request to OpenAI
          const response = await fetch(api_url, {
            method: api_method,
            headers: {'Content-Type': api_content_type, Authorization: api_auth_key,},
            body: JSON.stringify({
              model: api_model,
              messages: [sysMessage, ...messages, userMessage],
            }),
          });

          const data = await response.json();

          if (response.ok) {
            // Add the bot's response to the chat
            const botMessage = {role: 'assistant', content: data.choices[0].message.content, timestamp: Date.now()};
            setMessages((prevMessages) => [...prevMessages, botMessage]);
            
            if(is_closing && window.getComputedStyle(document.getElementById('end_btn')).display === 'none'){
              //console.log('is_closing else:', is_closing)
              document.getElementById('sent_btn').style.display = 'none'
              document.getElementById('end_btn').style.display = 'block'
            }
            setIsTextAreaDisabled(false);
            setIsStartTypeing(false);
          } else {
            console.error('Error:', data);
          }
          
        } catch (error) {
          console.error('Error communicating with OpenAI API:', error);
        }
      }, 1000);
    }
    else{
      setInput(''); 
      setIsTextAreaDisabled(false);
    }
    initial_execution = false;   
  };

  const calculateScore = async() => {
    //console.log('calculate score');
    sendMessage();
    document.getElementById('sent_btn').style.display = "none";
    txtArea.current.style.display = "none";
    document.getElementById('end_btn').style.display = "none";
    const chat_start_time = new Date(messages[0]['timestamp']);

    //Calculate Average hangle time for the chat.
    let AHT =  new Date(Date.now()).getTime() - chat_start_time.getTime();
    
    //console.log("AHT: ", AHT);
    //Format AHT to hours, minutes and seconds.
    let ss = (Math.floor(AHT / 1000) % 60).toString().padStart(2,'0');
    let mm = (Math.floor(AHT / 1000 / 60) % 60).toString().padStart(2,'0');
    let hh = (Math.floor(AHT / 1000 / 60 / 60)).toString().padStart(2,'0');

    //console.log("Average Handling Time: ", hh + ":" + mm + ":" + ss);
     // Store the formatted time in a variable
     const handleTimeValue = hh + ":" + mm + ":" + ss;
    setAvarageHandleTime(handleTimeValue)

    let assistance_response_time = [];
    let user_response_time = [];
    let diffrence_response_time_sec = [];

    messages.forEach(item => {
      //console.log("loop item: ", item);
      if(item['role']=='assistant')
        assistance_response_time.push(item['timestamp']);
      else
        user_response_time.push(item['timestamp']);
    });
    // console.log("assistance_response_time: ", assistance_response_time);
    // console.log("user_response_time: ", user_response_time);

    for(let i=0; i<user_response_time.length; i++){
      // console.log("user_response_time string: ", user_response_time[i]);
      // console.log("assistance_response_time string: ", assistance_response_time[i]);
      let ust = new Date(user_response_time[i]).getTime()
      let art = new Date(assistance_response_time[i]).getTime()
      // console.log("user_response_time: ", ust);
      // console.log("assistance_response_time: ", art);

      let diff = ust - art;
      // console.log("the diffrence is: ", diff);
      // console.log("the diffrence in sec: ", (Math.floor(diff / 1000) % 60).toString().padStart(2,'0'));
      diffrence_response_time_sec.push((Math.floor(diff / 1000) % 60))
    }
    //console.log("diffrence in response time: ", diffrence_response_time_sec);
    
    let sum_response_time=0;
    diffrence_response_time_sec.forEach(item =>{
      sum_response_time += item;
    });

    // console.log('sum response time: ',sum_response_time);
    // console.log('average response time: ', sum_response_time/diffrence_response_time_sec.length)
    // Calculate and store the response time value
    const responseTimeValue = (sum_response_time/diffrence_response_time_sec.length).toFixed(1);
    setAverageResponseTime(responseTimeValue);

    //Calculating typing speed
    console.log('typeSpeed: ',typeSpeed);
    let sum_type_speed = 0;
    typeSpeed.forEach(item=>{
      sum_type_speed+=parseFloat(item);
    });
    console.log('sum_type_speed: ',sum_type_speed);
    // Calculate and store the type speed value
    const typeSpeedValue = (sum_type_speed/typeSpeed.length).toFixed(1);
    setAverageTypeSpeed(typeSpeedValue)

    // Capture these values to pass to AWS callback
    const finalHandleTime = handleTimeValue;
    const finalResponseTime = responseTimeValue;
    const finalTypeSpeed = typeSpeedValue;


    //calculating sentiment analysis
    //console.log(messages)
    let user_messages=[];
    messages.forEach(dict=>{
      //console.log(dict['role']);
      if(dict['role'] == 'user'){
        user_messages.push(dict['content']);
      }
    });
    //console.log('user_message: ', user_messages);

    try{
        comprehend.batchDetectSentiment({"LanguageCode": "en", "TextList": user_messages}, function (err, data) {
          if (err) console.log("error form AWS: ", err, err.stack); // an error occurred
          else{//succesfull response
            console.log("succesful data comeback: ", data); 
            var list_csi_score = [];
            data.ResultList.forEach(item =>{
              var positive = parseFloat(item["SentimentScore"]["Positive"]);
              var negative = parseFloat(item["SentimentScore"]["Negative"]);
              var mixed = parseFloat(item["SentimentScore"]["Mixed"]);
              var neutral = parseFloat(item["SentimentScore"]["Neutral"]);

              list_csi_score.push((positive+((negative*-1)+(mixed*-0.5)+(neutral*-0.4)))*5);
            });

            console.log("List CSI score: ",list_csi_score)
            var sum_csi = 0;
            list_csi_score.forEach(item=>{
              sum_csi+=parseFloat(item)
            });

            // Calculate and store the sentiment score
          const finalSentimentScore = (sum_csi/list_csi_score.length).toFixed(2);
            setAverageSentimentScore(finalSentimentScore);

            // Wait a moment for other state updates to complete, then save to database
    setTimeout(() => {
      sendChatBotScoresToDatabase(
        finalHandleTime, 
        finalResponseTime, 
        finalTypeSpeed, 
        finalSentimentScore
      );
    }, 500);
          }
        });
      }catch(error){
        console.log('Error in sentiment score: ', error)
      }
    document.getElementById('pnl_simulation').style.display = "none";
    document.getElementById('score_holder').style.display = "block";
  };

  useEffect(()=>{
    if(!txtArea.current.disabled)
      txtArea.current.focus();

    if(msgDivRef.current){
      msgDivRef.current.scrollTop = msgDivRef.current.scrollHeight;
    } 
    if(initial_execution){
      sendMessage();      
    } 
  });

  return (
    <div className='simulation_container'>
      <div id='pnl_simulation' >
        <div className='headers'><i>This is a customer simulation app designed to help trainees gain real-world experience through realistic, AI-driven interactions.</i></div>
        <div className='chatContainer'>
          <div ref={msgDivRef} onInput={(e)=>console.log(e)} className='chatBox'>
            {messages.map((msg, index) => (
              <div               
                id='messge_box'
                key={index}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? '#DCF8C6' : 'rgb(245 245 245)',
                }}
                className='message'                
              >
                {msg.content}
              </div>
            ))}
          </div>
          <textarea
            id='txt_msg'
            ref={txtArea}
            disabled={isTextAreaDisabled}
            className='input'
            value={input}
            onChange={(e) => {
              setInput(e.target.value);       
            }}
            placeholder="Type your message..."   
            onKeyDown={(e) => {
              if(e.key==='Enter'){
                document.getElementById('sent_btn').click();            
              } 
              if(!isStartTypeing){
                setStartTypeTime(new Date());
                setIsStartTypeing(true);
              }          
            }}
          >{testAreaValue}</textarea>
          <div>
            <button id='end_btn' onClick={calculateScore} className='endButton' >End Chat</button>
            <button id='sent_btn' onClick={sendMessage} className='sendButton' >Send</button>
          </div>      
        </div>   
        <div className='note' ><span><b>Note: </b></span> <span><i>Take your time to understand the requirement and respond politely with clear, concise, and relevant answers, ensuring a positive and effective interaction.</i></span></div>
      </div>
      <div id='score_holder' className='pnl_score'>
        {/* <div><span>Average Handle Time: </span><span>{AverageHandleTime}</span></div>
        <div><span>Average Response Time: </span><span>{AverageResponseTime} secs.</span></div>
        <div><span>Average Type Speed: </span><span>{averageTypeSpeed} words/min.</span></div>
        <div><span>CSI score: </span><span>{averageSentimentScore}</span></div> */}
        <div className='score_section'><span className='left_content'>Average Handle Time: </span><span className='right_content'>40 sec</span></div>
        <div className='score_section'><span className='left_content'>Average Response Time: </span><span className='right_content'>20 secs.</span></div>
        <div className='score_section'><span className='left_content'>Average Type Speed: </span><span className='right_content'>520 words/min.</span></div>
        <div className='score_section'><span className='left_content'>CSI score: </span><span className='right_content'>2.2</span></div>

        <div className="home-button-container">
  <button 
    onClick={navigateToDashboard}
    className="home-button">
    Return to Dashboard
  </button>
</div>
      </div>
    </div>
  );
};
export default ChatBot;