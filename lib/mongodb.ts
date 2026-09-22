import { MongoClient, MongoClientOptions } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/prepay";
const options: MongoClientOptions = {};

let client;
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
  console.warn('Warning: Invalid/Missing environment variable: "MONGODB_URI". Skipping DB connection during build.');
  clientPromise = Promise.resolve(null as any);
} else {
  if (process.env.NODE_ENV === "development") {
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
}

export default clientPromise;
