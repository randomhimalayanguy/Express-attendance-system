import express, { NextFunction, Request, Response } from 'express';
import mongoose, {Schema} from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


// Const
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'Temp-Secret-Key';

// mongoose
mongoose.connect('mongodb://localhost:27017/attendance')
.then(()=>console.log(`Database connected`))
.catch((err)=>console.log(`Can't connect to database : ${err}`));

// App
const app = express();

class AppError extends Error{
    statusCode : number;
    constructor(msg : string, statusCode = 500){
        super(msg);
        this.statusCode = statusCode;
    }
}


// Interfaces
interface AuthRequest extends Request{
    user? : {userId : string};
}


interface IStudent{
    name : string,
    enrollment_number : string
    department : string,
    mor_shift : boolean,
    batch : string,
    section : string,
    semester : number,
    phone_no : string,
    address : string
}

interface IAdmin{
    username : string,
    password : string
}

interface ILog extends mongoose.Document{
    student_id : mongoose.Types.ObjectId,
    status : boolean
}


// Schemas - 
const studentSchema = new Schema<IStudent>({
    name : {type : String, required : true},
    enrollment_number : {type : String, required : true, unique : true},
    department : {type : String, required : true},
    mor_shift : {type : Boolean, required : true},
    batch : {type : String, required : true},
    section : {type : String},
    semester : {type : Number, required : true, min : 1},
    phone_no : {type : String},
    address : {type : String}
});


const adminSchema = new Schema<IAdmin>({
    username : {type : String, required : true, unique : true},
    password : {type : String, required : true, minlength : 6}
});

adminSchema.pre('save', async function(next) {
    if(!this.isModified('password')) return next();

    this.password = await bcrypt.hash(this.password, 12);
    next();
})


const logSchema = new Schema<ILog>({
    student_id : {type : Schema.Types.ObjectId, requried : true, ref : 'Student'},
    status : {type : Boolean, default : false}
},{timestamps : true});


// Models
const Student = mongoose.model('Student', studentSchema);

const Admin = mongoose.model('Admin', adminSchema);

const Log = mongoose.model('Log', logSchema);


// Middleware
app.use(express.json());

const authenticate = (req : AuthRequest, res : Response, next : NextFunction)=>{
    try{
        const authHeader = req.header("Authorization");

        if(!authHeader || authHeader.split(' ').length != 2)
            return next(new AppError(`Cannot Authenticate`, 409));

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, SECRET_KEY) as {userId : string};
        req.user = decoded;
        next();
    }
    catch(err){
        next(new AppError(`Can't authenticate : ${err}`, 500));
    }

};


// Routes
app.post('/register', async (req : Request, res : Response, next : NextFunction)=>{
    try{
        const {username, password} = req.body;

        if(!username || !password)
            return next(new AppError(`You must provide username and password`, 400));

        if(password.length < 6)
            return next(new AppError(`Password must be atleast 6 characters long`, 400));

        const admin = await Admin.findOne({username});
        if(admin)
            return next(new AppError(`ID already exist, try login instead`, 409));

        const newAdmin = new Admin({
            username : username,
            password : password
        });

        await newAdmin.save();
        const {password : _, ...userWithoutPassword} = newAdmin.toObject();

        res.status(201).json({Msg : "User Created", userWithoutPassword});
    }
    catch(err){
        next(new AppError(`Can't register the user : ${err}`, 500));
    }
});


app.post('/login', async (req : Request, res : Response, next : NextFunction)=>{
    try{
        const {username, password} = req.body;
        if(!username || !password)
            return next(new AppError(`You must provide username and password`, 400));

        const admin = await Admin.findOne({username});
        if(!admin)
            return next(new AppError(`User does not exist, register first`, 409));

        if(!(await bcrypt.compare(password, admin.password)))
            return next(new AppError(`Wrong credentials`, 409));
        

        const token = jwt.sign({
            userId : admin._id
        }, SECRET_KEY, 
        {expiresIn : '1h'});

        const {password : _, ...userWithoutPassword} = admin.toObject();

        res.status(201).json({Msg : "Logged in", userWithoutPassword, token});
    }
    catch(err){
        next(new AppError(`Can't register the user : ${err}`, 500));
    }
});


app.post('/student', authenticate, async (req : Request, res : Response, next : NextFunction)=>{
    try{
        // Required - name, enrollment_number, department, mor_shift(bool), batch, semester (number)
        // not required - section, phone_no and address

        const {name, enrollment_number, department, mor_shift = true, 
            batch, semester=1, section, phone_no, address} = req.body;
        
        if(!enrollment_number)
            return next(new AppError(`You must provide enrollement number`, 400));

        const normalizedEnrollmentNumber = enrollment_number.replace(/^0+/, '') || '0';
        
        if(!name || !department || !batch){
            return next(new AppError(`You must include all details - name, enrollment_number, department, 
                mor_shift, batch, semester`, 400));
        }

        const student = await Student.findOne({enrollment_number : normalizedEnrollmentNumber});
        if(student)
            return next(new AppError(`Student already exist`, 400));

        const newStudent = new Student({
            name : name,
            enrollment_number : normalizedEnrollmentNumber,
            address : address,
            batch : batch,
            department : department,
            semester : semester,
            mor_shift : mor_shift,
            phone_no : phone_no,
            section : section
        });
        console.log('Reaching here');
        await newStudent.save();
        res.status(201).json({Msg : "Student added", newStudent});
    }
    catch(err){
        next(new AppError(`Can't add the student : ${err}`));
    }
});


app.post('/entry', async (req : Request, res : Response, next : NextFunction)=>{
    try{
        const {enrollment_number} = req.body;

        const student = await Student.findOne({enrollment_number});
        if(!student)
            return next(new AppError(`No student with this enrollment number`, 400));



    }
    catch(err){
        next(new AppError(`Can't process entry : ${err}`, 500));
    }
});


app.get('/', authenticate, (req: Request, res: Response) => {
  res.json({
    message: 'Hello from Express + TypeScript!',
    timestamp: new Date().toISOString()
  });
});


// Error handling middleware
app.use((err: AppError, req: Request, res: Response, next : NextFunction) => {
  console.error(err.message);
  res.status(err.statusCode).json({ error: err.message});
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});