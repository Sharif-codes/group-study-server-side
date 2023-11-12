const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(cors({
    origin: ['http://localhost:5173', 'https://group-study-10c82.web.app', 'https://group-study-10c82.firebaseapp.com/'],
    credentials: true
}))
app.use(express.json())

app.use(cookieParser())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@groupstudy.kqtrbew.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
// auth middleware
const logger = async (req, res, next) => {
    console.log('called', req.host, req.originalUrl)
    next()
}
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCES_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ messae: 'unauthorized access' })
        }
        req.user = decoded;
        next()
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const allAssignmentCollection = client.db('assignmentDB').collection('allAssignment')
        const submittedAssignmentCollection = client.db('assignmentDB').collection('submittedAssignment')
        app.post('/jwt', async (req, res) => {
            const user = req.body
            console.log(user)
            const token = jwt.sign(user, process.env.ACCES_TOKEN_SECRET, { expiresIn: '1h' })
            res.cookie('token',token,{
                httpOnly: true,
                secure: true,
                sameSite: 'none'

            })
                // .cookie('token', token, {
                //     httpOnly: true,
                //     secure: process.env.NODE_ENV === 'production',
                //     sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                // })
                .send({ success: true })
        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('logging out', user);
            res
                .clearCookie('token', { maxAge: 0, sameSite: 'none', secure: true })
                .send({ success: true })
         })
        app.post('/add-assignment', async (req, res) => {
            const data = req.body
            console.log(data)
            const result = await allAssignmentCollection.insertOne(data)
            res.send(result)
        })
        app.get('/get-assignment', async (req, res) => {
            const page= parseInt(req.query.page)
            const size= parseInt(req.query.size)
            console.log(page,size)
            const result = await allAssignmentCollection.find()
            .skip(page*size)
            .limit(size)
            .toArray()
            res.send(result)
        })
        app.get('/assignment/:difficulty', async (req, res) => {
            const difficulty = req.params.difficulty
            const query = { difficulty: difficulty }
            const result = await allAssignmentCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/single-assignment/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await allAssignmentCollection.findOne(query)
            res.send(result)
        })
        app.get('/update-assignment/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await allAssignmentCollection.findOne(query)
            res.send(result)
        })
        app.put('/updated-assignment/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const option = { upsert: true }
            const updatedAssignment = req.body
            const assignment = {
                $set: {

                    title: updatedAssignment.title,
                    description: updatedAssignment.description,
                    mark: updatedAssignment.mark,
                    thumbnail: updatedAssignment.thumbnail,
                    due: updatedAssignment.due,
                    difficulty: updatedAssignment.difficulty

                }
            }
            const result = await allAssignmentCollection.updateOne(filter, assignment, option)
            res.send(result);

        })
        app.delete('/delete-assignment/', logger, async (req, res) => {
            const id = req.body._id;
            const email = req.body.email;
            const queryById = { _id: new ObjectId(id) };
            const existingItem = await allAssignmentCollection.findOne(queryById);

            if (existingItem) {
                if (existingItem.createdBy === email) {
                    await allAssignmentCollection.deleteOne(queryById);
                    res.status(200).json({ message: 'Assignment deleted successfully' });
                } else {
                    console.log('Email does not match the ID');
                    res.status(403).json({ message: 'Forbiddden: You are not the author of this assignment' });
                }
            } else {
                console.log('No item found with the specified ID');
                res.status(404).json({ message: 'No Assignment found' });
            }
        });

        app.post('/submit-assignment', async (req, res) => {
            const data = req.body
            const result = await submittedAssignmentCollection.insertOne(data)
            res.send(result)
        })
        app.get('/get-submitted-assignment/:email', async (req, res) => {
            const email = req.params.email
            const query = { examineeEmail: email }
            const result = await submittedAssignmentCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/get-all-submitted-assignment', async (req, res) => {
            const query = { status: "pending" }
            const result = await submittedAssignmentCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/give-mark/:id', async (req, res) => {
            const id = req.params.id
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await submittedAssignmentCollection.findOne(query)
            res.send(result)
        })
        app.patch('/give-mark/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedAssignment = req.body
            const updatedDoc = {
                $set: {
                    feedback: updatedAssignment.feedback,
                    mark: updatedAssignment.mark,
                    status: updatedAssignment.status
                }
            }
            const result = await submittedAssignmentCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        app.get('/assignment-count', async (req, res) => {
            const count = await allAssignmentCollection.estimatedDocumentCount()
            res.send({ count })
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('car doctor server is running')
})
app.listen(port, () => {
    console.log(`Port is running at ${port}`)
})

