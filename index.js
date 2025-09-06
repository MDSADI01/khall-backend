const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000;

const Stripe = require("stripe");
const stripe = Stripe(process.env.PAYMENT_GATEWAY_KEY);


// Enable CORS for all routes
app.use(cors());

// Enable JSON parsing
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Meal is getting Ready');
});

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@zrgalaxy.2ewpa2a.mongodb.net/?retryWrites=true&w=majority&appName=ZRGALAXY`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    const usersCollection = client.db('hallMeals').collection('users');
    const mealsCollection = client.db('hallMeals').collection('meals');
    const requestedMealsCollection = client.db('hallMeals').collection('requestedMeals');
    const subscriptionCollection = client.db('hallMeals').collection('subscription');
    const paymentsCollection = client.db('hallMeals').collection('payments');

    


    app.post('/users', async (req, res) => {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.send(result);
      });

      app.get('/users', async (req, res) => {
          const users = await usersCollection.find().toArray();
          res.send(users);
      });

      app.get('/users/noAdmin', async (req, res) => {
        const { search } = req.query;
        let query = { role: { $ne: 'admin' } }; // exclude admins
      
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ];
        }
      
        const users = await usersCollection.find(query).toArray();
        res.send(users);
      });


      app.patch("/users/makeAdmin/:id", async (req, res) => {
        const id = req.params.id;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: "admin" } }
        );
        res.send(result);
      });
      
      



      app.post('/meals', async (req, res) => {
        const {
          name,
          image,
          distributorName,
          description,
          ingredients,
          postTime,
          rating = 0,
          likes = 0,
          price,
          category,
          reviews = []
        } = req.body;
      
        if (!name || !image || !distributorName || !description || !ingredients || !postTime || !price || !category) {
          return res.status(400).json({ message: "All required fields must be provided." });
        }
      
        const newMeal = {
          name,
          image,
          distributorName,
          description,
          ingredients,
          postTime: new Date(postTime),
          rating,
          likes,
          price,
          category,
          reviews
        };
      
        const result = await mealsCollection.insertOne(newMeal);
        res.status(201).json({ message: "Meal added successfully", mealId: result.insertedId });
      });
      
      


    app.get('/meals', async (req,res)=>{
      const { sortBy } = req.query;

  if(sortBy === 'reviews_count') {
    const meals = await mealsCollection.aggregate([
      { $addFields: { reviews_count: { $size: "$reviews" } } },
      { $sort: { reviews_count: -1 } }
    ]).toArray();
    return res.send(meals);
  }

  const sortOption = sortBy ? { [sortBy]: -1 } : {};
  const meals = await mealsCollection.find().sort(sortOption).toArray();
  res.send(meals);
    })


    app.delete('/meals/:id', async (req, res) => {
      const { id } = req.params;
    
      try {
        const result = await mealsCollection.deleteOne({ _id: new ObjectId(id) });
    
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Meal not found" });
        }
    
        res.json({ message: "Meal deleted successfully" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    

app.get('/meals/:id', async (req, res) => {
  const id = req.params.id;
 
    const meal = await mealsCollection.findOne({ _id: new ObjectId(id) });
    res.send(meal);
 
});
app.get('/meals/:id/likes', async (req, res) => {
  const meal = await mealsCollection.findOne(
    { _id: new ObjectId(req.params.id) },
    { projection: { likes: 1, _id: 0 } }
  );
  res.send(meal?.likes || []);
});


app.patch("/meals/:id/likes", async (req, res) => {
  try {
    const incrementValue = req.body.increment || 1;
    const updatedMeal = await mealsCollection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $inc: { likes: incrementValue } },
      { returnDocument: "after" }
    );

    if (!updatedMeal.value) {
      return res.status(404).json({ message: "Meal not found" });
    }

    res.json({ likes: updatedMeal.value.likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/meals/:id/reviews', async (req, res) => {
  const meal = await mealsCollection.findOne(
    { _id: new ObjectId(req.params.id) },
    { projection: { reviews: 1, _id: 0 } }
  );
  res.send(meal?.reviews || []);
});



app.post('/meals/:id/reviews', async (req, res) => {
  const id = req.params.id;
  const newReview = {
    user: req.body.user,
    comment: req.body.comment,
    date: new Date().toISOString(),
  };

  const updatedMeal = await mealsCollection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $push: { reviews: newReview } },
    { returnDocument: "after" }
  );

  res.json(updatedMeal.value.reviews);
});



// Get all reviews from all meals
app.get('/reviews', async (req, res) => {
  try {
    const meals = await mealsCollection.find({}, { projection: { name: 1, reviews: 1 } }).toArray();

  
    const allReviews = meals.flatMap(meal =>
      meal.reviews.map(review => ({
        mealId: meal._id,
        mealName: meal.name,
        ...review
      }))
    );

    res.json(allReviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a review by mealId and review index
app.delete('/meals/:mealId/reviews/:index', async (req, res) => {
  const { mealId, index } = req.params;

  try {
    const meal = await mealsCollection.findOne({ _id: new ObjectId(mealId) });
    if (!meal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    const reviewIndex = Number(index);

    if (isNaN(reviewIndex) || reviewIndex < 0 || reviewIndex >= meal.reviews.length) {
      return res.status(400).json({ message: "Invalid review index" });
    }
    // Remove the review at the specified index
    meal.reviews.splice(reviewIndex, 1);

    // Update the meal document
    await mealsCollection.updateOne(
      { _id: new ObjectId(mealId) },
      { $set: { reviews: meal.reviews } }
    );

    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get reviews of the logged-in user by email
app.get('/myReviews', async (req, res) => {
  try {
    const { email } = req.query; // example: /myReviews?email=student1@gmail.com
    if (!email) {
      return res.status(400).json({ message: "User email is required" });
    }

    const meals = await mealsCollection.find({}, { projection: { name: 1, reviews: 1 } }).toArray();

    const userReviews = meals.flatMap(meal =>
      meal.reviews
        .filter(review => review.user === email) // filter by email
        .map(review => ({
          mealId: meal._id,
          mealName: meal.name,
          ...review
        }))
    );

    res.json(userReviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a review by mealId + index
app.delete('/myReviews/:mealId/:index', async (req, res) => {
  const { mealId, index } = req.params;

  try {
    const meal = await mealsCollection.findOne({ _id: new ObjectId(mealId) });
    if (!meal) return res.status(404).json({ message: "Meal not found" });

    const reviewIndex = Number(index);
    if (isNaN(reviewIndex) || reviewIndex < 0 || reviewIndex >= meal.reviews.length) {
      return res.status(400).json({ message: "Invalid review index" });
    }

    meal.reviews.splice(reviewIndex, 1); // remove review

    await mealsCollection.updateOne(
      { _id: new ObjectId(mealId) },
      { $set: { reviews: meal.reviews } }
    );

    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// PATCH update review comment by mealId + index
app.patch('/myReviews/:mealId/:index', async (req, res) => {
  const { mealId, index } = req.params;
  const { comment } = req.body;

  try {
    const meal = await mealsCollection.findOne({ _id: new ObjectId(mealId) });
    if (!meal) return res.status(404).json({ message: "Meal not found" });

    const reviewIndex = Number(index);
    if (isNaN(reviewIndex) || reviewIndex < 0 || reviewIndex >= meal.reviews.length) {
      return res.status(400).json({ message: "Invalid review index" });
    }

    meal.reviews[reviewIndex].comment = comment; // update comment

    await mealsCollection.updateOne(
      { _id: new ObjectId(mealId) },
      { $set: { reviews: meal.reviews } }
    );

    res.json({ message: "Review updated successfully", review: meal.reviews[reviewIndex] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/requestedMeals', async (req, res) => {
  try {
    const requestedMeal = req.body;

    // Validate required fields
    const requiredFields = [
      "name",
      "category",
      "description",
      "ingredients",
      "price",
      "postTime",
      "distributorName",
      "distributorEmail",
      "image"
    ];

    for (const field of requiredFields) {
      if (!requestedMeal[field]) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // Optional defaults
    requestedMeal.likes = 0;
    requestedMeal.reviews_count = 0;
    requestedMeal.status = "Pending";

    const result = await requestedMealsCollection.insertOne(requestedMeal);
    res.status(201).json({ message: "Requested meal added successfully", id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get requested meals with optional search
app.get("/requestedMeals", async (req, res) => {
  const { search } = req.query;

  let query = {};
  if (search) {
    query = {
      $or: [
        { distributorEmail: { $regex: search, $options: "i" } }, // search by email
        { distributorName: { $regex: search, $options: "i" } }   // search by name
      ]
    };
  }

  const meals = await requestedMealsCollection.find(query).toArray();
  res.json(meals);
});

// ✅ Serve a meal (change status to delivered)
app.patch("/requestedMeals/serve/:id", async (req, res) => {
  const { id } = req.params;
  const result = await requestedMealsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "delivered" } }
  );

  res.json({ message: "Meal served successfully", result });
});



app.delete('/requestedMeals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await requestedMealsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Requested meal not found" });
    }

    res.json({ message: "Requested meal cancelled successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const upcomingMealsCollection = client.db('hallMeals').collection('upcomingMeals');

// Add upcoming meal
app.post('/upcomingMeals', async (req, res) => {
  try {
    const meal = req.body;
    const requiredFields = ["name","category","description","ingredients","price","postTime","distributorName","distributorEmail","image"];
    for (const field of requiredFields) {
      if (!meal[field]) return res.status(400).json({ message: `${field} is required` });
    }
    meal.likes = 0;
    meal.reviews_count = 0;
    meal.status = "Pending";
    const result = await upcomingMealsCollection.insertOne(meal);
    res.status(201).json({ message: "Upcoming meal added", id: result.insertedId });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all upcoming meals
app.get('/upcomingMeals', async (req, res) => {
  try {
    const meals = await upcomingMealsCollection.find().toArray();
    res.json(meals);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Publish upcoming meal (move to mealsCollection)
app.post('/upcomingMeals/publish/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const meal = await upcomingMealsCollection.findOne({ _id: new ObjectId(id) });
    if (!meal) return res.status(404).json({ message: "Meal not found" });

    const mealToAdd = {
      name: meal.name,
      category: meal.category,
      image: meal.image,
      ingredients: meal.ingredients,
      description: meal.description,
      price: meal.price,
      postTime: new Date(meal.postTime),
      distributorName: meal.distributorName,
      distributorEmail: meal.distributorEmail,
      likes: meal.likes || 0,
      rating: 0,
      reviews: []
    };

    await mealsCollection.insertOne(mealToAdd);
    await upcomingMealsCollection.deleteOne({ _id: new ObjectId(id) });

    res.json({ message: "Meal published successfully" });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/subscription', async (req, res) => {
  const subscription = await subscriptionCollection.find().toArray();
  res.send(subscription);
});

app.get('/subscription/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const subscription = await subscriptionCollection.findOne({ _id: new ObjectId(id) });

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    res.json(subscription);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.body.amount,
      currency: 'usd',
      // Add payment_method_types array if using specific payment methods
    });
    
    res.send({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

 app.post("/payments", async (req, res) => {
     try {
       const { userEmail, subscriptionId, amount, paymentId, status, badge } = req.body;
  
       // 1. Save payment info
       const paymentResult = await paymentsCollection.insertOne({
         userEmail,
         subscriptionId: new ObjectId(subscriptionId),
         amount,
         paymentId,
        status,
        badge,
        createdAt: new Date(),
       });
  
       // 2. Update user badge
       await usersCollection.updateOne(
         { email: userEmail },
         { $set: { badge: badge } }
      );

     res.send({ success: true, paymentResult });
   } catch (err) {
       res.status(500).send({ success: false, error: err.message });
     }
   });



   app.get("/payments", async (req, res) => {
    try {
      const payments = await paymentsCollection
        .find()
        .sort({ createdAt: -1 }) // newest first
        .toArray();
  
      res.json(payments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


   app.get("/payments/:email", async (req, res) => {
    try {
         const { email } = req.params;
        const payments = await paymentsCollection.find({ userEmail: email }).toArray();
         res.json(payments);
       } catch (err) {
         res.status(500).json({ error: err.message });
       }
     });
  

















    

   
    
    
    


    
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Meal is running on http://localhost:${port}`);
});
