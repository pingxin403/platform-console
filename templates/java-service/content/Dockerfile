FROM openjdk:${{ values.javaVersion }}-jre-slim

# Set working directory
WORKDIR /app

# Copy the JAR file
COPY target/${{ values.name }}-*.jar app.jar

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${{ values.port }}/actuator/health || exit 1

# Expose port
EXPOSE ${{ values.port }}

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]