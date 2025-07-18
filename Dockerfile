# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Install TypeScript globally for compilation
RUN npm install -g typescript ts-node

# Expose port
EXPOSE 3000

# Start the application with Node.js
CMD ["node", "src/deploy-server.js"]