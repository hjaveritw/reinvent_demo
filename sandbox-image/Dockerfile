# Hermetic, pre-warmed build image for the VPC-isolated CodeBuild sandbox (no internet access).
# All Maven dependencies and plugins required by pom-template.xml are resolved at image build time.
FROM maven:3.9.9-eclipse-temurin-21
WORKDIR /opt/warmup
COPY pom-template.xml /opt/pom-template.xml
COPY warmup/src ./src
RUN sed -e 's/__GROUP_ID__/warm/' -e 's/__ARTIFACT_ID__/warmup/' /opt/pom-template.xml > pom.xml \
 && mvn -B -q verify \
 && mvn -B -q dependency:go-offline \
 && rm -rf /opt/warmup/target
ENV MAVEN_OPTS="-Xmx2g"
WORKDIR /workspace
