const chai = require("chai");
const expect = chai.expect;
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const User = require("../src/models/User");
const DoctorSchedule = require("../src/models/DoctorSchedule");
const authService = require("../src/services/authService");

let mongoServer;

describe("authService (integration)", function () {
	this.timeout(20000);

	before(async () => {
		process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
		mongoServer = await MongoMemoryServer.create();
		await mongoose.connect(mongoServer.getUri(), {
			dbName: "mocha_Test",
		});
	});

	after(async () => {
		if (mongoose.connection.readyState !== 0) {
			await mongoose.connection.dropDatabase();
			await mongoose.disconnect();
		}

		if (mongoServer) {
			await mongoServer.stop();
		}
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
