import "missing-native-js-functions";

export function FieldErrors(fields: Record<string, { code?: string; message: string }>) {
	return new FieldError(
		50035,
		"Invalid Form Body",
		fields.map(({ message, code }) => ({
			_errors: [
				{
					message,
					code: code || "BASE_TYPE_INVALID"
				}
			]
		}))
	);
}

// TODO: implement Image data type: Data URI scheme that supports JPG, GIF, and PNG formats. An example Data URI format is: data:image/jpeg;base64,BASE64_ENCODED_JPEG_IMAGE_DATA
// Ensure you use the proper content type (image/jpeg, image/png, image/gif) that matches the image data being provided.

export class FieldError extends Error {
	constructor(public code: string | number, public message: string, public errors?: any) {
		super(message);
	}
}
