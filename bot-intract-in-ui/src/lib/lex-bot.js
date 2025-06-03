import AWS from 'aws-sdk';
import { ungzip } from 'pako';
import { Buffer } from 'buffer';
import * as io from "socket.io-client";
import { useNavigate } from 'react-router-dom';

function unzip(buffer_string){
  // decode the base64 encoded data
  const gzipedData = Buffer.from(buffer_string, "base64");

  //console.log('gzipeddata', gzipedData);
  const ungzipedData = ungzip(gzipedData);

  //console.log('ungzipedData', ungzipedData);
  return new TextDecoder().decode(ungzipedData);
}

const socket = io.connect('http://localhost:8081'); 
//const navigate = useNavigate();

AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_LEX_CLIENTID,
  secretAccessKey: process.env.REACT_APP_AWS_LEX_SECRETKEY,
  region: process.env.REACT_APP_AWS_LEX_REGION
})

const lexV2Client = new AWS.LexRuntimeV2();

var bot_alias_id = process.env.REACT_APP_BOT_ALIAS_ID;
var bot_id= process.env.REACT_APP_BOT_ID;
var locale_id = process.env.REACT_APP_LOCALE_ID;
var session_id = process.env.REACT_APP_SESSION_ID_FORMAT +"_"+ Date.now();
var request_content_type = process.env.REACT_APP_REQUEST_CONTENT_TYPE;
var response_content_type = process.env.REACT_APP_RESPONSE_CONTENT_TYPE
var input_stream = process.env.REACT_APP_INITIAL_INPUT;
var audio_player = null;

var lex_params = {
  "botAliasId": bot_alias_id,
  "botId": bot_id,
  "localeId": locale_id,
  "sessionId": session_id,
  "requestContentType": request_content_type,
  "responseContentType":response_content_type,
  "inputStream":input_stream
};

export default function getLexResponse(_inputStream, _requestContentType){
  console.log("--------------------------------Inside Lex Response Function---------------------------------")
  console.log("check button disable");
  let question="";
  let answer = [];
  lex_params.inputStream = _inputStream;
  lex_params.requestContentType=_requestContentType;
  let questionList=[];
  let sentiment=[];

  console.log("start call to lex.")
  lexV2Client.recognizeUtterance(lex_params, async function(err, data){
    console.log("--------------------------------Request made to AWS Lex---------------------------------")
    if (err)
      console.log(err);
    else{
      try{
        console.log("Lex response start.");
        document.getElementById('end_rec')?.click();

        var session_state = unzip(data.sessionState);
        var json_session_state = JSON.parse(session_state);
        //console.log(json_session_state["sessionAttributes"]);
        var audioBlob = new Blob([data.audioStream], { type: 'audio/mpeg' }); 

        //console.log("Lex response start. 1");
        //check the lex state for the flow.
        if(json_session_state['intent']['state'] !== "Fulfilled"){
          //document.getElementById('ques_no').innerHTML=(json_session_state["dialogAction"]["slotToElicit"]).replace('_', ' #');
          question=json_session_state["sessionAttributes"][json_session_state["dialogAction"]["slotToElicit"]];
          console.log("fulfilled");

        }
        else{
          document.getElementById('test_end_message').style.display="block";
          document.getElementById('exam_content').style.display="none";
          console.log("after fulfilled");
        }
        
        //console.log("Lex response start. 2"); 
        //load audio blob in audio control
        audio_player = document.getElementById('audio'); 
        audio_player.autoplay=false; 
        audio_player.src = URL.createObjectURL(audioBlob);
        //audio_player.autoplay=true;

        console.log("outside if",sessionStorage.getItem('first_page_load'));

        if(sessionStorage.getItem('first_page_load') === 'false'){
          console.log("inside if",sessionStorage.getItem('first_page_load'));
          audio_player.autoplay=true;
        }

        let disp_ques = document.getElementById('ques-disp');
        disp_ques.textContent = question;

        console.log("json session state:", json_session_state);
        console.log("sentiment1",JSON.parse(json_session_state["sessionAttributes"]['cscore_1']));
        console.log("sentiment1",JSON.parse(json_session_state["sessionAttributes"]['cscore_1'])["Positive"]);
        //body_css.style.backgroundImage = "url('./images/speeking.gif')";
        audio_player.addEventListener("ended", function(){
          if(json_session_state['intent']['state'] == "Fulfilled"){
            
            

            var slots = json_session_state['intent']['slots'];
            for(let i=1; i<=Object.keys(slots).length; i++){
              answer[i-1]=slots['Question_'+i]['value']['originalValue'];
              questionList[i-1]=json_session_state["sessionAttributes"]['Question_'+i];
              sentiment[i-1]=JSON.parse(json_session_state["sessionAttributes"]['cscore_'+i]);
            }
            console.log(answer);
            console.log(sentiment);
            sessionStorage.setItem('lex_answers', answer);

            socket.emit("lexanswers", answer, questionList);

            socket.emit("lexquestions", questionList);

            socket.emit("lexsentiment", sentiment);
            //window.location.href = '/test-complete.html';
            //const navigate = useNavigate();
            document.getElementById('grammar_redirect')?.click();


            //navigate('/TypeTest.tsx');
          }
          //document.getElementById('start_rec')?.click();
          //document.getElementById('end_rec')?.click();
        });
      }catch(error){
        console.log("Error from Lex bot: "+error)
      }
    }
  });
}