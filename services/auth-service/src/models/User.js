const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ALLOWED_DEPARTMENTS = [
	"Medicine",
	"Surgery",
	"Orthopedics",
	"Pediatrics",
	"ENT",
	"Ophthalmology",
	"Gynecology",
	"Dermatology",
	"Oncology",
];

const isAlphaNumeric = (character) => {
	const code = character.charCodeAt(0);
	return (
		(code >= 48 && code <= 57) ||
		(code >= 65 && code <= 90) ||
		(code >= 97 && code <= 122)
	);
};

const isWhitespace = (character) => {
	const code = character.charCodeAt(0);
	return (
		code === 9 ||
		code === 10 ||
		code === 11 ||
		code === 12 ||
		code === 13 ||
		code === 32
	);
};

const isValidDomainLabel = (label) => {
	if (!label || label.startsWith("-") || label.endsWith("-")) {
		return false;
	}

	for (const character of label) {
		if (!isAlphaNumeric(character) && character !== "-") {
			return false;
		}
	}

	return true;
};

const isValidEmail = (email) => {
	if (typeof email !== "string" || email.length === 0 || email.length > 254) {
		return false;
	}

	for (const character of email) {
		if (isWhitespace(character)) {
			return false;
		}
	}

	const atIndex = email.indexOf("@");
	if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) {
		return false;
	}

	const localPart = email.slice(0, atIndex);
	const domainPart = email.slice(atIndex + 1);
	if (!localPart || !domainPart || domainPart.startsWith(".") || domainPart.endsWith(".")) {
		return false;
	}

	const domainLabels = domainPart.split(".");
	if (domainLabels.length < 2) {
		return false;
	}

	return domainLabels.every(isValidDomainLabel);
};

const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
			trim: true,
			validate: {
				validator: isValidEmail,
				message: "Please provide a valid email address",
			},
		},
		passwordHash: {
			type: String,
			required: false,
			minlength: [8, "Password must be at least 8 characters"],
		},
		googleId: {
			type: String,
			required: false,
			unique: true,
			sparse: true,
		},
		authProvider: {
			type: String,
			enum: ["local", "google"],
			default: "local",
		},
		firstName: {
			type: String,
			required: [true, "First name is required"],
			trim: true,
		},
		lastName: {
			type: String,
			required: [true, "Last name is required"],
			trim: true,
		},
		role: {
			type: String,
			required: [true, "Role is required"],
			enum: ["clerk", "doctor", "nurse", "paramedic", "clinician", "admin"],
			default: "clerk",
		},
		phoneNumber: { type: String, trim: true },
		department: {
			type: [{ type: String, trim: true, enum: ALLOWED_DEPARTMENTS }],
			validate: [
				{
					validator: function (departments) {
						if (!["doctor", "nurse", "clinician"].includes(this.role))
							return true;
						return Array.isArray(departments) && departments.length > 0;
					},
					message:
						"Doctors, nurses, and clinicians must belong to at least one department",
				},
				{
					validator: function (departments) {
						if (this.role !== "doctor") return true;
						return Array.isArray(departments) && departments.length === 1;
					},
					message: "Doctors must belong to exactly one department",
				},
			],
		},
		isActive: { type: Boolean, default: true },
		lastLogin: { type: Date },
	},
	{ timestamps: true },
);

userSchema.pre("save", function (next) {
	if (typeof this.department === "string") {
		this.department = this.department.trim() ? [this.department.trim()] : [];
	}

	if (Array.isArray(this.department)) {
		this.department = this.department
			.map((dept) => (typeof dept === "string" ? dept.trim() : dept))
			.filter(Boolean);
	}

	if (this.authProvider === "google" && !this.googleId) {
		next(new Error("Google users must have googleId"));
	} else if (this.authProvider === "local" && !this.passwordHash) {
		next(new Error("Local users must have passwordHash"));
	} else {
		next();
	}
});

// email index is created automatically by unique: true above
userSchema.index({ role: 1 });
userSchema.index({ department: 1 });

userSchema.virtual("fullName").get(function () {
	return `${this.firstName} ${this.lastName}`;
});

userSchema.methods.comparePassword = async function (candidatePassword) {
	if (!this.passwordHash) return false;
	return await bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.toJSON = function () {
	const userObject = this.toObject();
	delete userObject.passwordHash;
	return userObject;
};

module.exports = mongoose.model("User", userSchema);
