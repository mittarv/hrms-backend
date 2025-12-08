const host = `http://${process.env.IP}:${process.env.PORT}`;

module.exports = {
  info: {
    // API informations (required)
    title: 'Mittarv API documentation ', // Title (required)
    version: '1.0.0', // Version (required)
    description: 'A sample API', // Description (optional)
  },

  

  host: 'localhost:5000',// Host (optional)
  basePath: '/api/', // Base path (optional)
  apis: [],
};

//https://www.acuriousanimal.com/blog/20181020/express-swagger-doc