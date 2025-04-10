import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Configura o dotenv com o caminho correto do arquivo .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Use diretamente a string de conexão para teste
const MONGODB_URI = "mongodb+srv://thiago:reOfHH13eD3Tfhzp@ticketimage0.yzkdhgy.mongodb.net/?retryWrites=true&w=majority&appName=ticketimage0";

console.log("🔄 Iniciando teste de conexão...");

async function testConnection() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectado ao MongoDB com sucesso!");

    const result = await mongoose.connection.collection("test").insertOne({ 
      test: true, 
      date: new Date() 
    });
    console.log("✅ Teste de escrita realizado com sucesso!", result.insertedId);

  } catch (error) {
    console.error("❌ Erro ao conectar:", error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("✅ Conexão fechada");
    }
    process.exit();
  }
}

testConnection();