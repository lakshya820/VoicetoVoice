console.log("from server side");
const express = require("express");
const speech = require("@google-cloud/speech");

require('dotenv').config();

// Imports the fs library to establish file system
const fs = require('fs');

//use logger
const logger = require("morgan");

//use body parser
const bodyParser = require("body-parser");

//use corrs
const cors = require("cors");

//use openAI
//const {OpenAI} = require("openai")

const { AzureOpenAI } = require("openai");  

const http = require("http");
const { Server } = require("socket.io");

const app = express();

// Add this near the top of your file with other imports
const { Pool } = require('pg');

// Set up PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_database_name',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

app.use(cors());
app.use(logger("dev"));

app.use(bodyParser.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const videoFileMap={
  'cdn':'videos/cdn.mp4',
}

// Initialize Azure OpenAI client using the updated SDK approach
const azureOpenAIEndpoint = process.env.AZURE_OPENAI_ENDPOINT || "https://azure-openai-voicetest-01.openai.azure.com/";
const azureOpenAIKey = process.env.AZURE_OPENAI_API_KEY;
const azureOpenAIApiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview";
const azureOpenAIDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4-deployment-01";

const openaiClient = new AzureOpenAI({
  endpoint: azureOpenAIEndpoint,
  apiKey: azureOpenAIKey,
  apiVersion: azureOpenAIApiVersion,
  deployment: azureOpenAIDeployment
});


//TODO: Create this file in the server directory of the project
process.env.GOOGLE_APPLICATION_CREDENTIALS = "./speech-to-text-key.json";

const speechClient = new speech.SpeechClient();

app.get('/videos/:filename', (req, res)=>{
  const fileName = req.params.filename;
  const filePath = videoFileMap[fileName]
  if(!filePath){
      return res.status(404).send('File not found')
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if(range){
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, {start, end});
      const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4'
      };
      res.writeHead(206, head);
      file.pipe(res);
  }
  else{
      const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4'
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res)
  }
})

// Add this function to insert data into your PostgreSQL table
async function saveResultsToDatabase(grammarResult, swotAnalysis, sentimentScore) {
  const client = await pool.connect();
  
  try {
    // Create a timestamp for when the record is created
    const timestamp = new Date();
    
    // Convert objects to JSON strings if needed
    const grammarResultJSON = typeof grammarResult === 'object' ? JSON.stringify(grammarResult) : grammarResult;
    const swotAnalysisJSON = typeof swotAnalysis === 'object' ? JSON.stringify(swotAnalysis) : swotAnalysis;
    const sentimentScoreJSON = typeof sentimentScore === 'object' ? JSON.stringify(sentimentScore) : sentimentScore;
    
    // SQL query to insert data
    const query = `
      INSERT INTO analysis_results 
      (grammar_result, swot_analysis, sentiment_score, created_at) 
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    // Values to insert
    const values = [grammarResultJSON, swotAnalysisJSON, sentimentScoreJSON, timestamp];
    
    // Execute the query
    const result = await client.query(query, values);
    
    console.log(`Data saved to database with ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  } catch (err) {
    console.error('Error saving to database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Then add your test endpoint for Postman
app.post('/api/test-db', async (req, res) => {
  try {
    // Extract test data from request body
    const { grammarResult, swotAnalysis, sentimentScore } = req.body;
    
    // Use the database save function
    const savedId = await saveResultsToDatabase(grammarResult, swotAnalysis, sentimentScore);
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Data successfully saved to database',
      id: savedId
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save data to database',
      error: error.message
    });
  }
});


// Add this function to your Express server
async function saveSpeechScores(accuracyScore, fluencyScore, completenessScore, pronunciationScore) {
  const client = await pool.connect();
  
  try {
    const query = `
      INSERT INTO speech_assessment_scores 
      (accuracy_score, fluency_score, completeness_score, pronunciation_score, created_at) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const timestamp = new Date();
    const values = [
      accuracyScore, 
      fluencyScore, 
      completenessScore, 
      pronunciationScore, 
      timestamp
    ];
    
    const result = await client.query(query, values);
    
    console.log(`Speech scores saved to database with ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  } catch (err) {
    console.error('Error saving speech scores to database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Add this endpoint to your Express application
app.post('/api/speech-scores', async (req, res) => {
  try {
    // Extract scores from request body
    const { 
      accuracyScore, 
      fluencyScore, 
      completenessScore, 
      pronunciationScore 
    } = req.body;
    
    // Validate required fields
    if (
      fluencyScore === undefined || 
      completenessScore === undefined || 
      pronunciationScore === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required score fields'
      });
    }
    
    // Save scores to database
    const savedId = await saveSpeechScores(
      accuracyScore || 0,  // Default to 0 if not provided
      fluencyScore,
      completenessScore,
      pronunciationScore
    );
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Speech scores successfully saved',
      id: savedId
    });
  } catch (error) {
    console.error('Error in speech-scores endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save speech scores',
      error: error.message
    });
  }
});

// Function to save ChatBot scores to the database
async function saveChatBotScores(averageHandleTime, averageResponseTime, averageTypeSpeed, csiScore) {
  const client = await pool.connect();
  
  try {
    const query = `
      INSERT INTO chatbot_scores 
      (average_handle_time, average_response_time, average_type_speed, csi_score, created_at) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const timestamp = new Date();
    const values = [
      averageHandleTime, 
      averageResponseTime, 
      averageTypeSpeed, 
      csiScore, 
      timestamp
    ];
    
    const result = await client.query(query, values);
    
    console.log(`ChatBot scores saved to database with ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  } catch (err) {
    console.error('Error saving ChatBot scores to database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// API endpoint to receive ChatBot scores
app.post('/api/chatbot-scores', async (req, res) => {
  try {
    // Extract scores from request body
    const { 
      averageHandleTime, 
      averageResponseTime, 
      averageTypeSpeed,
      csiScore 
    } = req.body;
    
    // Validate required fields
    if (
      averageHandleTime === undefined || 
      averageResponseTime === undefined || 
      averageTypeSpeed === undefined ||
      csiScore === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required score fields'
      });
    }
    
    // Save scores to database
    const savedId = await saveChatBotScores(
      averageHandleTime,
      averageResponseTime,
      averageTypeSpeed,
      csiScore
    );
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'ChatBot scores successfully saved',
      id: savedId
    });
  } catch (error) {
    console.error('Error in chatbot-scores endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save ChatBot scores',
      error: error.message
    });
  }
});

// API endpoint to get only the latest analysis result (without SWOT analysis)
app.get('/api/latest-analysis-result', async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Query to get only the latest record from the analysis_results table
    const query = `
      SELECT id, 
             sentiment_score,
             swot_analysis,
             grammar_result,
             created_at
      FROM analysis_results 
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await client.query(query);
    
    // Format response
    const response = {
      success: true,
      result: result.rows.length > 0 ? result.rows[0] : null
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching latest analysis result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest analysis result',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// API endpoint to get only the latest chatbot score
app.get('/api/latest-chatbot-score', async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Query to get only the latest record from the chatbot_scores table
    const query = `
      SELECT id, 
             average_handle_time, 
             average_response_time, 
             average_type_speed, 
             csi_score, 
             created_at
      FROM chatbot_scores 
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await client.query(query);
    
    // Format response
    const response = {
      success: true,
      result: result.rows.length > 0 ? result.rows[0] : null
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching latest chatbot score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest chatbot score',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// API endpoint to get only the latest speech assessment score
app.get('/api/latest-speech-score', async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Query to get only the latest record from the speech_assessment_scores table
    const query = `
      SELECT id, 
             fluency_score, 
             completeness_score, 
             pronunciation_score, 
             created_at
      FROM speech_assessment_scores 
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await client.query(query);
    
    // Format response
    const response = {
      success: true,
      result: result.rows.length > 0 ? result.rows[0] : null
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching latest speech assessment score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest speech assessment score',
      error: error.message
    });
  } finally {
    client.release();
  }
});

io.on("connection", (socket) => {
  let recognizeStream = null;
  console.log("** a user connected - " + socket.id + " **\n");

  socket.on("voice_assistant_input", async (data) => {
    try {
      console.log("Received voice assistant input:", data.text);
      
      // Extract data from the event
      const userInput = data.text;
      const conversationHistory = data.history || [];
      const kbArticle = data.context || "";
      
      // Create messages array for OpenAI API
      const messages = [
        { 
          role: 'system', 
          content: `You are a helpful voice assistant for IT support that communicates naturally with users. You're having a natural conversation where users can interrupt you or ask you to repeat information.

                 Answer questions based primarily on the following knowledge base article. If the question cannot be answered using this knowledge, politely state that you don't have that information.
                 
                 Important formatting instructions:
                 1. Structure complex answers with numbered steps (e.g., "1. First step", "2. Second step")
                 2. Keep each step or section concise for easier comprehension in audio format
                 3. Include clear section headers when appropriate
                 4. Break down technical processes into clear, sequential instructions
                 
                 The user is interacting with you by voice, and can say things like:
                 - "Stop I didn't catch that" - which means you should be prepared to repeat information
                 - "Please repeat the step about X" - which means you should repeat a specific section
                 - "I couldn't understand what you said about Y" - which means elaborate on that topic
                 
                 KNOWLEDGE BASE ARTICLE:
                 ${kbArticle}
                 
                 Remember, you're having a natural conversation, so keep your responses clear, concise, and well-structured.` 
        },
        ...conversationHistory,
        { role: 'user', content: userInput }
      ];
      
      // Call OpenAI API using your existing openai instance
      const completion = await openaiClient.chat.completions.create({
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000
      });
      
      // Extract AI response
      const aiResponse = completion.choices[0].message.content;
      
      // Send the response back to the client
      socket.emit("voice_assistant_response", { 
        success: true, 
        text: aiResponse 
      });
      
    } catch (error) {
      console.error("Error processing voice assistant input:", error);
      socket.emit("voice_assistant_response", { 
        success: false, 
        error: "Failed to process your request" 
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("** user disconnected ** \n");
  });

  socket.on("send_message", (message) => {
    setTimeout(() => {
      //io.emit("receive_message", "got this message " + message);
    }, 1000);
  });

  socket.on("startGoogleCloudStream", function (data) {
    startRecognitionStream(this, data);
  });

  socket.on("endGoogleCloudStream", function () {
    console.log("** ending google cloud stream **\n");
    stopRecognitionStream();
  });
 
  let swotAnswer=null;
  socket.on('lexanswers', async (data) => {
    //console.log('Received answers from Lex:', data);
    answers=data;

    socket.on('lexquestions',async (data) => {

      let csi_score=0.0;
      socket.on("lexsentiment", (data) => {
        csi_score=sentiment_calc(data);
        console.log("**sentiment_backend:", csi_score);
        
      })
      //console.log('Received questions from Lex:', data);
      questions=data;
      if(questions !== null){

       
        relevanceresult = await relevance(answers, questions);
        //console.log("relevanceResult: ", relevanceresult);

        grammarCorrectionResult = await grammarcorrection(answers, questions);

        //console.log(grammarCorrectionResult.grammarComment, relevanceresult.comprehensionComment, relevanceresult.fluencyComment);

        swotResult = await swot(grammarCorrectionResult.grammarComment, relevanceresult.comprehensionComment, relevanceresult.fluencyComment);
        swotAnswer=swotResult;
        //console.log("grammarReceived", grammarCorrectionResult);
        io.emit("grammarCorrectionResult", grammarCorrectionResult);
        console.log("sendingswotdata: ",swotAnswer );
        io.emit("swotAnalysisResult", swotAnswer);
        io.emit("lexsentimenttofrontend", csi_score);
        //io.emit("questions", questions);

        // Add this code to save to database
    try {
      const savedId = await saveResultsToDatabase(grammarCorrectionResult, swotAnswer, csi_score);
      console.log(`Results saved to database with ID: ${savedId}`);
      
      // Optionally notify frontend
      io.emit("dataSavedToDatabase", { success: true, id: savedId });
    } catch (dbError) {
      console.error("Failed to save data to database:", dbError);
    }
      
     
    }
    });

  });

  // if(swotAnswer){
    
  // }

  socket.on("send_audio_data", async (audioData) => {
    io.emit("receive_message", "Got audio data");
    if (recognizeStream !== null) {
      try {
        //console.log(`audio data: `, audioData.audio);
        recognizeStream.write(audioData.audio);
      } catch (err) {
        console.log("Error calling google api " + err);
      }
    } else {
      console.log("RecognizeStream is null");
    }
  });

  function startRecognitionStream(client) {
    console.log("* StartRecognitionStream\n");
    try {
      recognizeStream = speechClient
        .streamingRecognize(config)
        .on("error", console.error)
        .on("data", (data) => {
          console.log("StartRecognitionStream: data: "+data)
          const result = data.results[0];
          const isFinal = result.isFinal;

          const transcription = data.results
            .map((result) => result.alternatives[0].transcript)
            .join("\n");

          console.log(`Transcription: `, transcription);
          console.log(isFinal);

          client.emit("receive_audio_text", {
            text: transcription,
            isFinal: isFinal,
          });

          // if end of utterance, let's restart stream
          // this is a small hack to keep restarting the stream on the server and keep the connection with Google api
          // Google api disconects the stream every five minutes
          if (data.results[0] && data.results[0].isFinal) {
            stopRecognitionStream();
            startRecognitionStream(client);
          }
        });
    } catch (err) {
      console.error("Error streaming google api " + err);
    }
  }

  function stopRecognitionStream() {
    if (recognizeStream) {
      console.log("* StopRecognitionStream \n");
      recognizeStream.end();
    }
    recognizeStream = null;
  }
});

async function grammarcorrection(grammarArray, questions) {
   
  // Initialize arrays for each function call
  let correctedGrammarArray = [];
  let correct = [];
  let incorrect = [];
  let count = 0;
  let total;
  const sentences = grammarArray;
  let grammarComment = "";
 
 
 //console.log("sentences: ", sentences);
 try {
     // Iterate over each string in the grammarArray
     for (const grammar of grammarArray) {
         const completion = await openai.chat.completions.create({
             model: "gpt-4o-mini",
             messages: [
                 {
                     role: "system",
                     content: "You will be provided with statements. If a statement is already grammatically correct (e.g., 'I don't know', 'I've been eating a lot') do not change it.  Do not add any commas even if needed. Accept casual English, including abbreviations and slang. Focus on fixing major grammatical errors like verb tenses, subject-verb agreement, and sentence structure, but leave informal language as it is (e.g., 'I'm gonna', 'wanna', 'LOL')."
                 },
                 {
                     role: "user",
                     content: grammar
                 }
             ],
             temperature: 0,
             max_tokens: 60,
             top_p: 1.0,
             frequency_penalty: 0.0,
             presence_penalty: 0.0,
         });

         const grammarResult = completion.choices[0].message.content;
         //console.log("grammarresult_backend", grammarResult);

         // Push the corrected result into the array
         correctedGrammarArray.push(grammarResult);
     }

     const incorrect = grammarArray.flatMap(text =>
       text.split(/(?<=\.)\s*/).filter(sentence => sentence.trim() !== "")
     );
     //console.log("incorrect: ", incorrect);

     const correct = correctedGrammarArray.flatMap(text =>
       text.split(/(?<=\.)\s*/).filter(sentence => sentence.trim() !== "")
     );
     //console.log("correct: ", correct);

     for (let i = 0; i < sentences.length; i++) {
       if(sentences[i] !== correctedGrammarArray[i]){
         // incorrect.push(sentences[i]);
         // correct.push(correctedGrammarArray[i]);
         count++;
       }
     }
     
     //console.log("correctedgrammararray: ", correctedGrammarArray);
 } catch (error) {
     console.log("error", `Something happened! like: ${error}`);
     next(error); // If you're using this in an Express route, pass the error to the next middleware
 }

 total=(1-(count/(sentences.length)))*100;
 // console.log("counr:", count);
 // console.log("length:", grammarArray.length);
 // console.log("total:", total);
 // Return the array of corrected results

  if (total <= 25) {
    grammarComment="Grammar: Unsatisfactory";
    //console.log("Grammar: Unsatisfactory");
  } else if (total <= 50 && total > 25) {
    grammarComment="Grammar: Needs Improvement";
    //console.log("Grammar: Needs Improvement");
  } else {
    grammarComment="Grammar: Met Expectations";
    //console.log("Grammar: Met Expectations");
  }
 return {
   questions,
   grammarArray,
   correctedGrammarArray,
   total,
   grammarComment
 };
}

async function relevance(answers, questions) {

  let relevanceScoreArray=[];
  let comprehensionComment="";
  let fluencyComment="";
  let relevanceScore=0;

  for (let i = 0; i < answers.length; i++) {
    const question = questions[i];
    const answer = answers[i];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
          {
              role: "system",
              content: "Please evaluate the correctness of the following answer on a scale of 1 to 10, where 1 is completely incorrect and 10 is completely correct. Consider the relevance of the answer in relation to the question. Return only a single number with no words."
          },
          {
              role: "user",
              content: `Question: ${question} Answer: ${answer}`
          }
      ],
      temperature: 0,
      max_tokens: 60,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
    });

    //console.log(`Response for question ${i + 1}:`, completion.choices[0].message.content);
    relevanceScoreArray.push(completion.choices[0].message.content);
    relevanceScore=relevanceScore + completion.choices[0].message.content;
  }

  //console.log("relevanceArrayLength", (relevanceScoreArray.length));
  if ((relevanceScore/(relevanceScoreArray.length)) <= 3) {
    comprehensionComment="Comprehension: Unsatisfactory";
    fluencyComment="Fluency/Thought process: Unsatisfactory";
    //console.log("Relevance: Unsatisfactory");
  } else if ((relevanceScore/(relevanceScoreArray.length)) <= 6 && (relevanceScore/(relevanceScoreArray.length)) > 3) {
    comprehensionComment="Comprehension: Needs Improvement";
    fluencyComment="Fluency/Thought Process: Needs Improvement";
    //console.log("Relevance: Needs Improvement");
  } else {
    comprehensionComment="Comprehension: Met expectations";
    fluencyComment="Fluency/Thought process: Met expectations";
    //console.log("Relevance: Met Expectations");
  }

  return{
    comprehensionComment,
    fluencyComment
  }
}

async function swot(grammar, comprehension, fluency){

  let swotAnalysis="";
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
        {
            role: "system",
            content: "Based on the following parameters and their values, create a SWOT analysis with separate paragraphs for Strengths, Weaknesses, Opportunities, and Threats. Do not include a main 'SWOT Analysis' header, but start directly with each section label followed by the analysis. Any paragraph should not exceed 5o words."
        },
        {
            role: "user",
            content: `${grammar}  ${comprehension} ${fluency}`
        }
    ],
    temperature: 0,
    //max_tokens: 60,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
  });

  swotAnalysis=completion.choices[0].message.content;
  //console.log("swotAnalysis: ", swotAnalysis)

  return swotAnalysis
  
}

function sentiment_calc(data){
  let csi=0;
  let final_csi=0;

  // Example: Extracting Positive sentiment scores
  const positiveScores = data.map(entry => entry.Positive);
  console.log('Positive Scores:', positiveScores);

  // Example: Extracting Negative sentiment scores
  const negativeScores = data.map(entry => entry.Negative);
  console.log('Negative Scores:', negativeScores);

  // Example: Extracting Neutral sentiment scores
  const neutralScores = data.map(entry => entry.Neutral);
  console.log('Neutral Scores:', neutralScores);

  // Example: Extracting Mixed sentiment scores
  const mixedScores = data.map(entry => entry.Mixed);
  console.log('Mixed Scores:', mixedScores);

  console.log('length of array:', positiveScores.length);

  for (let i = 0; i < positiveScores.length; i++) {
   csi=csi+(positiveScores[i]-negativeScores[i]-(mixedScores[i]*0.5)-(neutralScores[i]*0.4))
   //csi=csi+(positiveScores[i]-((negativeScores[i]*-1)+(mixedScores[i]*-0.5)+(neutralScores[i]*-0.8)))
   console.log("csi: ", (positiveScores[i]-negativeScores[i]-(mixedScores[i]*0.5)));
  }

  final_csi=(csi/4)*5;
  console.log("final_csi: ", final_csi)

  return {
  final_csi
  }
}
//const port = process.env.PORT || 8081;
server.listen(8081, () => {
  console.log("WebSocket server listening on port 8081.");
});

// =========================== GOOGLE CLOUD SETTINGS ================================ //

// The encoding of the audio file, e.g. 'LINEAR16'
// The sample rate of the audio file in hertz, e.g. 16000
// The BCP-47 language code to use, e.g. 'en-US'
const encoding = "LINEAR16";
const sampleRateHertz = 16000;
const languageCode = "en-US"
const alternativeLanguageCodes = ["en-IN"];

const config = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
    alternativeLanguageCodes: alternativeLanguageCodes,
    //enableWordTimeOffsets: true,  
    enableAutomaticPunctuation: true,
    //enableWordConfidence: true,
    //Speker deserilization
    //enableSpeakerDiarization: true,  
    //minSpeakerCount: 1,  
    //Silence detection
    enable_silence_detection: true,
    //no_input_timeout: 5,
    single_utterance : false, //
    interimResults: false,
    //diarizationSpeakerCount: 2,
    //model: "video",
    model: "latest_long",
    //model: "phone_call",
    //model: "command_and_search",
    useEnhanced: true,
  },
};
