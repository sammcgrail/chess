FROM nginx:alpine
COPY index.html /usr/share/nginx/html/
COPY dist/ /usr/share/nginx/html/dist/
COPY css/ /usr/share/nginx/html/css/
COPY lib/ /usr/share/nginx/html/lib/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8779
