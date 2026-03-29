const chai = require("chai");
const expect = chai.expect;
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const User = require("../src/models/User");
const DoctorSchedule = require("../src/models/DoctorSchedule");
const authService = require("../src/services/authService");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let MONGO_URI = process.env.MONGODB_URI;
if (MONGO_URI && MONGO_URI.includes("/?")) {
	MONGO_URI = MONGO_URI.replace(/\/(\?|$)/, "/mocha_Test$1");
} else if (MONGO_URI && !MONGO_URI.match(/\/(\w+)\?/)) {
	MONGO_URI = MONGO_URI.replace(/\/?$/, "/mocha_Test");
}

describe("authService (integration)", function () {
	this.timeout(20000);

	before(async () => {
		await mongoose.connect(MONGO_URI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});
	});

	after(async () => {
		await mongoose.connection.dropDatabase();
		await mongoose.disconnect();
	});

	beforeEach(async () => {
		await User.deleteMany({});
		await DoctorSchedule.deleteMany({});
	});

	describe("register", () => {
		it("should create user and return token", async () => {
			const result = await authService.register({
				email: "new@example.com",
				password: "pw123456",
				firstName: "A",
				lastName: "B",
			});
			expect(result).to.have.property("token");
			const user = await User.findOne({ email: "new@example.com" });
			expect(user).to.exist;
		});

		it("should throw if user exists", async () => {
			await authService.register({
				email: "new@example.com",
				password: "pw123456",
				firstName: "A",
				lastName: "B",
			});
			try {
				await authService.register({
					email: "new@example.com",
					password: "pw123456",
					firstName: "A",
					lastName: "B",
				});
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).to.match(/already exists/);
			}
		});
	});

	describe("login", () => {
		it("should throw if user not found", async () => {
			try {
				await authService.login("notfound@example.com", "pw");
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).to.match(/Invalid email or password/);
			}
		});
	});
});
