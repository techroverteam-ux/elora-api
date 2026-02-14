import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import basicAuth from 'express-basic-auth';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Elora API',
      version: '1.0.0',
      description: 'Elora Crafting Arts API Documentation',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://elora-api-smoky.vercel.app' 
          : 'http://localhost:5000',
        description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.route.ts'],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  // Basic auth middleware for Swagger
  const swaggerAuth = basicAuth({
    users: {
      [process.env.SWAGGER_USERNAME || 'admin']: process.env.SWAGGER_PASSWORD || 'elora2026'
    },
    challenge: true,
    realm: 'Elora API Documentation',
  });

  // Apply auth to swagger routes
  app.use('/api-docs', swaggerAuth);
  
  // Serve swagger with proper asset configuration for Vercel
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', (req, res) => {
    res.send(
      swaggerUi.generateHTML(specs, {
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui { font-family: 'Inter', sans-serif }
          .swagger-ui .info .title { color: #1f2937 }
        `,
        customSiteTitle: 'Elora API Documentation',
        swaggerOptions: {
          persistAuthorization: true,
        },
        customfavIcon: '/favicon.ico',
        customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
        customJs: [
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js'
        ]
      })
    );
  });

  console.log('📚 Swagger docs available at /api-docs');
  console.log(`🔐 Username: ${process.env.SWAGGER_USERNAME || 'admin'}`);
  console.log(`🔐 Password: ${process.env.SWAGGER_PASSWORD || 'elora2026'}`);
};