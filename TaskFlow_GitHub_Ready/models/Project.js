const mongoose=require('mongoose');
module.exports=mongoose.model('Project',new mongoose.Schema({name:{type:String,required:true,trim:true},description:{type:String,default:''},status:{type:String,enum:['planning','active','completed'],default:'planning'},owner:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}},{timestamps:true}));
