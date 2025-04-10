import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import cors from 'cors';

const app = express();
const MONGODB_URI = 'mongodb+srv://thiago:reOfHH13eD3Tfhzp@ticketimage0.yzkdhgy.mongodb.net/?retryWrites=true&w=majority&appName=ticketimage0';

console.log('🔄 Iniciando servidor...');

// Middlewares
app.use(cors());
app.use(express.json());

// Configuração do Multer
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Interface para o documento de imagem
interface IImage extends mongoose.Document {
  filename: string;
  contentType: string;
  data: Buffer;
  uploadDate: Date;
}

// Schema do MongoDB
const imageSchema = new mongoose.Schema<IImage>({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
  uploadDate: { type: Date, default: Date.now }
});

const Image = mongoose.model<IImage>('Image', imageSchema);

// Conexão MongoDB
console.log('🔄 Conectando ao MongoDB...');

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado ao MongoDB com sucesso!');
    
    // Inicia o servidor apenas após conectar ao MongoDB
    const PORT = 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Erro ao conectar ao MongoDB:', err);
    process.exit(1); // Encerra o processo se não conseguir conectar
  });

// Handlers
const testHandler = (_req: Request, res: Response) => {
  res.json({ 
    message: 'Servidor funcionando!',
    mongoStatus: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
    timestamp: new Date().toISOString()
  });
};

const uploadHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('📝 Recebendo upload...', req.file?.originalname);
    
    if (!req.file) {
      console.log('❌ Nenhum arquivo recebido');
      res.status(400).json({ error: 'Nenhuma imagem enviada' });
      return;
    }

    console.log('📄 Detalhes do arquivo:', {
      nome: req.file.originalname,
      tipo: req.file.mimetype,
      tamanho: req.file.size
    });

    const image = new Image({
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      data: req.file.buffer
    });

    await image.save();
    console.log('✅ Imagem salva com ID:', image._id);

    res.json({
      success: true,
      imageUrl: `/api/images/${image._id}`,
      message: 'Upload realizado com sucesso!'
    });
  } catch (error) {
    console.error('❌ Erro no upload:', error);
    next(error);
  }
};

const getImageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const image = await Image.findById(req.params.id);
    
    if (!image) {
      res.status(404).json({ error: 'Imagem não encontrada' });
      return;
    }

    res.set('Content-Type', image.contentType);
    res.send(image.data);
  } catch (error) {
    next(error);
  }
};

const listImagesHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const images = await Image.find({}, { data: 0 });
    res.json(images);
  } catch (error) {
    next(error);
  }
};

// Rotas
app.get('/api/test', testHandler);
app.post('/api/upload', upload.single('image'), uploadHandler);
app.get('/api/images/:id', getImageHandler);
app.get('/api/images', listImagesHandler);

// Middleware de erro
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Erro:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: err.message
  });
});