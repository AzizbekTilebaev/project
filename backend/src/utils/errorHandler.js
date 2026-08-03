/**
 * Detailed error handler utility
 * Returns user-friendly error messages based on error type
 */
export const handleError = (error, req, res) => {
  console.error('Error details:', {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    code: error.code,
    meta: error.meta,
  });

  // Prisma errors
  if (error.code === 'P2002') {
    return res.status(400).json({
      error: 'Bul maǵlıwmat aldınnan bar',
      details: error.meta?.target || 'Unique constraint violation',
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({
      error: 'Maǵlıwmat tabılmadı',
      details: error.meta?.cause || 'Record not found',
    });
  }

  if (error.code === 'P2003') {
    return res.status(400).json({
      error: 'Maǵlıwmat nadurıs',
      details: 'Foreign key constraint failed',
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token jaramlı emes',
      details: 'Token formatı nadurıs',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Tokenniń múddeti tawsılǵan',
      details: 'Token expired',
    });
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Maǵlıwmatlar nadurıs',
      details: error.message,
    });
  }

  // Database connection errors
  if (error.code === 'ENOENT' || error.message?.includes('DATABASE_URL')) {
    return res.status(500).json({
      error: 'Maǵlıwmatlar bazasına jalǵanıw qáteligi',
      details: process.env.NODE_ENV === 'development' 
        ? 'DATABASE_URL ortalıq ózgeriwshisi tabılmadı yamasa nadurıs'
        : 'Database configuration error',
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const errorMessage = process.env.NODE_ENV === 'development'
    ? error.message || 'Server qáteligi'
    : 'Server qáteligi';

  return res.status(statusCode).json({
    error: errorMessage,
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
};



