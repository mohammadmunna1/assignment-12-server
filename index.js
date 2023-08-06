const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors())
app.use(express.json())



//mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wn76jxi.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const classesCollection = client.db('ESports').collection('classes')
        const instructorsCollection = client.db('ESports').collection('instructors')
        const usersCollection = client.db('ESports').collection('users')
        const selectionCollection = client.db('ESports').collection('selections')
        const paymentCollection = client.db('ESports').collection('payments')

        //Classes related api
        app.get('/classes', async (req, res) => {
          
            const limit = parseInt(req.query.limit);
            const email = req.query.email
            const query = email ? { instructor_email: email } : {};
            const options = {
                sort: { no_of_students: -1 },
                limit: limit
            };
           
            const result = await classesCollection.find(query, options).toArray()
            
            res.send(result)
        })
        //patch for setting class status
        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            let updateDoc = {}
           
            const filter = { _id: new ObjectId(id) }
            const status = req.body.newStatus
            const feedback = req.body.textareaValue
            const updatedValues = req.body.updatedValues
            const options = { upsert: true };

           
            if (status) {
                updateDoc = {
                    $set: {
                        status: status
                    }
                }
            }
            else if (feedback) {
                updateDoc = {
                    $set: {
                        feedback: feedback
                    }
                }
            }

            else if (updatedValues) {
                if(updatedValues.name =='' && updatedValues.price =='' && updatedValues.image ==''){
                    updateDoc = {
                        $set: {
                            
                        }
                    }
                }
                else if(updatedValues.name =='' && updatedValues.price =='' ){
                    updateDoc = {
                        $set: {
                            image: updatedValues.image
                        }
                    }
                }
                else if(updatedValues.price =='' && updatedValues.image ==''){
                    updateDoc = {
                        $set: {
                            name: updatedValues.name
                        }
                    }
                }
                else if(updatedValues.name =='' && updatedValues.image ==''){
                    updateDoc = {
                        $set: {
                            price: updatedValues.price
                        }
                    }
                }
                else if(updatedValues.name ==''){
                    updateDoc = {
                        $set: {
                            price: updatedValues.price,
                            image: updatedValues.image
                        }
                    }
                }
                else if(updatedValues.price ==''){
                    updateDoc = {
                        $set: {
                            name: updatedValues.name,
                            image: updatedValues.image
                        }
                    }
                }
                else if(updatedValues.image ==''){
                    updateDoc = {
                        $set: {
                            name: updatedValues.name,
                            price: updatedValues.price
                        }
                    }
                }
                else {
                    updateDoc = {
                        $set: {
                            name: updatedValues.name,
                            price: updatedValues.price,
                            image: updatedValues.image,
                        }
                    }
                }
            }
            
            const result = await classesCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        //put for increasing class available seats
        app.put('/classes/:id', async (req, res) => {
            const id = req.params.id;
            
            const filter = { _id: new ObjectId(id) }
            const update = { $inc: { no_of_students: 1, available_seats: -1 } };
           
            const result = await classesCollection.updateOne(filter, update)
            res.send(result)
        })

        app.post('/classes', async (req, res) => {
            const addedClass = req.body;
           
            const result = await classesCollection.insertOne(addedClass)
            res.send(result)
        })

        //Instructors related api
        app.get('/instructors', async (req, res) => {
            
            const limit = parseInt(req.query.limit);
            const result = await instructorsCollection.find().limit(limit).toArray()
            res.send(result)
        })

        //Users related api
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        app.get('/users/:email', async (req, res) => {
          
            const query = { email: req.params.email }
            const result = await usersCollection.findOne(query)
            res.send(result)
        })


        app.post('/users', async (req, res) => {
            const user = req.body
            const query= {email: user.email}
            const existingUser= await usersCollection.findOne(query)

           
            if(existingUser) return res.send({ message: 'User already exists' })

            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id;
          
            const filter = { _id: new ObjectId(id) }
            const updatedBooking = req.body
         
            const updateDoc = {
                $set: {
                    role: updatedBooking.newRole
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)
        });

        //Selections related api
        app.get('/selections', async (req, res) => {
            const email = req.query.email
            
            const query = { email: email };
            const result = await selectionCollection.find(query).toArray()
            res.send(result)
        })
        app.delete('/selections/:id', async (req, res) => {
            const id = req.params.id;
            
            const query = { _id: new ObjectId(id) }
            const result = await selectionCollection.deleteOne(query)
            res.send(result)
        })

        app.post('/selections', async (req, res) => {
            const selected = req.body
            const result = await selectionCollection.insertOne(selected)
            res.send(result)
        })


        //Create payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body
            const amount = parseInt(price * 100)
           
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({ clientSecret: paymentIntent.client_secret })
        })


        //Payment related API
        app.post('/payments', async (req, res) => {
            const payment = req.body
            const result = await paymentCollection.insertOne(payment)
            res.send(result)
        })

        app.get('/payments', async (req, res) => {
           
            const email = req.query.email
            const query = email? { email: email }: {};
            const options = {
                sort: { date: 1 }
            };
           
            const result = await paymentCollection.find(query, options).toArray()
            res.send(result)
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally { }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('E-sports is busy playing')
})

app.listen(port, () => {
    console.log(`E-sports server is running on port: ${port}`)
})