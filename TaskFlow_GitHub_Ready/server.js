require('dotenv').config();
const express=require('express'),mongoose=require('mongoose'),http=require('http'),{Server}=require('socket.io'),path=require('path');
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.json({limit:'100kb'}));app.use(express.static(path.join(__dirname,'public')));app.use('/api',require('./routes/api'));
io.on('connection',socket=>{socket.on('chatMessage',data=>{if(typeof data?.name!=='string'||typeof data?.text!=='string')return;const name=data.name.trim().slice(0,35),text=data.text.trim().slice(0,500);if(text)io.emit('chatMessage',{name:name||'Guest',text,time:new Date().toISOString()})})});
app.use((err,req,res,next)=>{console.error(err.message);res.status(err.status||((err.name==='ValidationError'||err.name==='CastError')?400:err.code===11000?409:500)).json({error:err.code===11000?'Duplicate value':err.message||'Server error'})});
(async()=>{if(!process.env.MONGO_URI)throw Error('MONGO_URI missing from .env');await mongoose.connect(process.env.MONGO_URI);console.log('MongoDB connected successfully!');server.listen(process.env.PORT||3000,()=>console.log('TaskFlow running at http://localhost:'+(process.env.PORT||3000)))})().catch(e=>{console.error('Startup failed:',e.message);process.exit(1)});
