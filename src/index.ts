import express, { NextFunction, Request, Response } from 'express';
import mongoose, {Schema} from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { appendFile } from 'fs';


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

// Helping functions - 
function getNormalizedNumber(enroll : string){
    return enroll.replace(/^0+/, '') || '0';
}

function startAndEndTime() : Date[]{
    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0);

    const endTime = new Date();
    endTime.setHours(23, 59, 59, 999);

    return [startTime, endTime];
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
    student_id : {type : Schema.Types.ObjectId, required : true, ref : 'Student'},
    status : {type : Boolean, default : false}
},{timestamps : true});

logSchema.index({student_id : 1, createdAt : -1});

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

const validate = (req : Request, res : Response, next : NextFunction)=>{
    try{
        const skip = parseInt(String(req.query.skip)) || 0;
        const limit = parseInt(String(req.query.limit)) || 20;

        if(skip < 0 || limit < 0)
            return next(new AppError(`Skip and limit must not be negative`, 400));
        
        req.query.skip = String(skip);
        req.query.limit = String(limit);
        next();
    }
    catch(err){
        next(new AppError(`Can't validate : ${err}`, 500));
    }
}


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

        res.status(200).json({Msg : "Logged in", userWithoutPassword, token});
    }
    catch(err){
        next(new AppError(`Can't login the user : ${err}`, 500));
    }
});


// Student -> Get (show students and allow filtering), Post (add student), Delete (delete student)

app.get('/student', authenticate, validate, async (req : Request, res : Response, next : NextFunction)=>{
    try{
        const skip = parseInt(String(req.query.skip));
        const limit = parseInt(String(req.query.limit));

        const students = await Student.find().limit(limit).skip(skip);

        res.status(201).json(students);
    }
    catch(err){
        next(new AppError(`Can't retrieve student list`, 500));
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

        const normalizedEnrollmentNumber = getNormalizedNumber(enrollment_number);
        
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
        await newStudent.save();
        res.status(201).json({Msg : "Student added", newStudent});
    }
    catch(err){
        next(new AppError(`Can't add the student : ${err}`));
    }
});


app.delete('/student', authenticate, async (req : Request, res : Response, next : NextFunction)=>{
    try{
        const {enrollment_number} = req.body;
        if(!enrollment_number)
            return next(new AppError(`You must provide enrollment number`, 400));

        const normalizedEnrollmentNumber = getNormalizedNumber(enrollment_number);
        const student = await Student.findOneAndDelete({enrollment_number : normalizedEnrollmentNumber});

        if(!student)
            return next(new AppError(`No student with this enrollment number`, 404));
        
        res.status(204).json({Msg : "Student deleted"});
    }
    catch(err){
        next(new AppError(`Can't delete the user : ${err}`, 500));
    }
});


app.post('/entry', async (req : Request, res : Response, next : NextFunction)=>{
    try{
        const {enrollment_number} = req.body;
        const normalizedEnrollmentNumber = getNormalizedNumber(enrollment_number);

        const student = await Student.findOne({enrollment_number : normalizedEnrollmentNumber});
        if(!student)
            return next(new AppError(`No student with this enrollment number`, 404));

        // Latest log for this student - 
        const log = await Log.findOne({student_id : student._id, 
            createdAt : {
                $gte : startAndEndTime()[0],
                $lte : startAndEndTime()[1]
            }
        }).sort({createdAt : -1});

        const newStatus = log ? !log.status : true;

        const newLog = new Log({
            student_id : student._id,
            status : newStatus
        });

        await newLog.save();

        const logWithUser = await newLog.populate('student_id', 'name');
        res.status(201).json({Msg : "Logged", logWithUser});
    }
    catch(err){
        next(new AppError(`Can't process entry : ${err}`, 500));
    }
});


app.get('/analytics', authenticate, async (req : Request, res : Response, next : NextFunction)=>{
    try{
        let pipeline: any[] = [
            { $match: { createdAt: { $gte: startAndEndTime()[0], $lte: startAndEndTime()[1] } } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$student_id', latestStatus: { $first: '$status' } } },
            { $match: { latestStatus: true } },
            
            {
                // Lookup to join Student details
            $lookup: {
                from: 'students', // Collection name
                localField: '_id',
                foreignField: '_id', // Student (schema) has primary key as _id
                as: 'student'
            }
            },

            { $unwind: '$student' }, // Flatten the array (assuming one-to-one)
            
            {
                // Project to include name and other fields
                $project: {
                // studentId: '$_id',
                    name: '$student.name',
                    dept: '$student.department',
                    semester: '$student.semester',
                    batch : '$student.batch'
                // latestStatus: 1, // Optional: keep if needed
                },
               
            }
      ];

      const studentsInside = await Log.aggregate(pipeline); 

        res.status(200).json({ 
            Msg: "Students currently inside", 
            date: new Date().toISOString().split('T')[0],
            totalInside : studentsInside.length,
            studentsInside,
        });
    }
    catch(err){
        next(new AppError(`Can't load analytics : ${err}`, 500));
    }
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