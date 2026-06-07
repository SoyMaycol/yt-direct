class YouTubeError extends Error {
  constructor(message, code = 'YOUTUBE_ERROR', details = null) {
    super(message);
    this.name = 'YouTubeError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class FormatError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'FORMAT_ERROR', details);
    this.name = 'FormatError';
  }
}

class QualityError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'QUALITY_ERROR', details);
    this.name = 'QualityError';
  }
}

class MergeError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'MERGE_ERROR', details);
    this.name = 'MergeError';
  }
}

class NetworkError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

class ValidationError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

module.exports = {
  YouTubeError,
  FormatError,
  QualityError,
  MergeError,
  NetworkError,
  ValidationError,
};
