FROM nginx:alpine

# Remove default configuration and copy ours
RUN rm /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
