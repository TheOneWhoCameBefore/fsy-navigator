# Use an official Node.js runtime as a parent image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if it exists)
# to install dependencies first. This leverages Docker's layer caching.
COPY package*.json ./

# --- IMPORTANT FIXES START HERE ---
# Remove node_modules and package-lock.json to ensure a clean install
# This addresses the npm bug related to optional dependencies
RUN rm -rf node_modules package-lock.json

# Install project dependencies including new Leaflet dependency
# Removed --no-optional for now to ensure all necessary native modules are installed
RUN npm install
# --- IMPORTANT FIXES END HERE ---

# Copy the rest of your application code to the working directory
COPY . .

# Expose the port that Vite will run on
EXPOSE 5173

# Command to run the application when the container starts
# This assumes you're running the development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
