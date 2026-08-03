class ResponseHelper {
    success(res, data, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data
        });
    }

    error(res, message, statusCode = 500, errors = null) {
        const response = {
            success: false,
            message,
        };
        if (errors) response.errors = errors;
        return res.status(statusCode).json(response);
    }
}

export default ResponseHelper;