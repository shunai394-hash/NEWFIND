#!/usr/bin/env bash
set -e

echo "===== Installing OpenJDK 21 for Capacitor 8 ====="

apt-get update
apt-get install -y openjdk-21-jdk

JAVA_HOME_21="/usr/lib/jvm/java-21-openjdk-amd64"

if [ ! -d "$JAVA_HOME_21" ]; then
  echo "ERROR: Java 21 installation directory not found: $JAVA_HOME_21"
  exit 1
fi

echo "===== Java 21 ====="
"$JAVA_HOME_21/bin/java" -version

echo "===== Configure Gradle ====="
echo "org.gradle.java.home=$JAVA_HOME_21" >> android/gradle.properties

echo "===== Gradle Java configuration ====="
grep "^org.gradle.java.home=" android/gradle.properties

echo "===== Pre-install complete ====="
