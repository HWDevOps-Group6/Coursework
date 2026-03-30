const chai = require("chai");
const expect = chai.expect;
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const User = require("../src/models/User");
const DoctorSchedule = require("../src/models/DoctorSchedule");
const authService = require("../src/services/authService");
const { verifyToken } = require("../src/utils/jwt");

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

		it("should create default schedule when role is doctor", async () => {
			const result = await authService.register({
				email: "doctor@example.com",
				password: "pw123456",
				firstName: "Doc",
				lastName: "Tor",
				role: "doctor",
				department: " Medicine ",
			});

			expect(result.user).to.have.property("role", "doctor");
			expect(result.user.department).to.deep.equal(["Medicine"]);

			const schedule = await DoctorSchedule.findOne({
				doctorId: result.user._id.toString(),
			});
			expect(schedule).to.exist;
			expect(schedule.department).to.equal("Medicine");
			expect(schedule.weeklyAvailability).to.have.length(7);
			expect(schedule.weeklyAvailability[0].slots).to.have.length(16);
		});

		it("should normalize department array values", async () => {
			const result = await authService.register({
				email: "nurse@example.com",
				password: "pw123456",
				firstName: "Nu",
				lastName: "Rse",
				role: "nurse",
				department: [" Pediatrics ", "", "ENT"],
			});

			expect(result.user.department).to.deep.equal(["Pediatrics", "ENT"]);
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

		it("should login and update lastLogin", async () => {
			await authService.register({
				email: "login@example.com",
				password: "pw123456",
				firstName: "Lo",
				lastName: "Gin",
			});

			const result = await authService.login("login@example.com", "pw123456");
			expect(result).to.have.property("token");

			const updated = await User.findOne({ email: "login@example.com" });
			expect(updated.lastLogin).to.be.instanceOf(Date);
		});

		it("should throw if account is deactivated", async () => {
			await authService.register({
				email: "inactive@example.com",
				password: "pw123456",
				firstName: "In",
				lastName: "Active",
			});

			await User.updateOne(
				{ email: "inactive@example.com" },
				{ $set: { isActive: false } },
			);

			try {
				await authService.login("inactive@example.com", "pw123456");
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).to.match(/deactivated/);
			}
		});

		it("should throw for wrong password", async () => {
			await authService.register({
				email: "wrongpw@example.com",
				password: "pw123456",
				firstName: "Wr",
				lastName: "Ong",
			});

			try {
				await authService.login("wrongpw@example.com", "bad-password");
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).to.match(/Invalid email or password/);
			}
		});
	});

	describe("findOrCreateFromGoogle", () => {
		it("should throw if email is not provided", async () => {
			try {
				await authService.findOrCreateFromGoogle({ id: "g1", emails: [] });
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).to.match(/Email not provided/);
			}
		});

		it("should create a new google user", async () => {
			const result = await authService.findOrCreateFromGoogle({
				id: "google-123",
				emails: [{ value: "GoogleUser@Example.com" }],
				name: { givenName: "Google", familyName: "User" },
			});

			expect(result).to.have.property("token");
			expect(result.user).to.have.property("authProvider", "google");

			const user = await User.findOne({ email: "googleuser@example.com" });
			expect(user).to.exist;
			expect(user.googleId).to.equal("google-123");
		});

		it("should link existing local user by email", async () => {
			await authService.register({
				email: "linkme@example.com",
				password: "pw123456",
				firstName: "Link",
				lastName: "Me",
			});

			const result = await authService.findOrCreateFromGoogle({
				id: "google-link-1",
				emails: [{ value: "linkme@example.com" }],
				name: { givenName: "Link", familyName: "Me" },
			});

			expect(result.user.googleId).to.equal("google-link-1");
			expect(result.user.authProvider).to.equal("google");
		});

		it("should update and return existing google user", async () => {
			await authService.findOrCreateFromGoogle({
				id: "google-existing",
				emails: [{ value: "existing@example.com" }],
				name: { givenName: "Ex", familyName: "Isting" },
			});

			const secondLogin = await authService.findOrCreateFromGoogle({
				id: "google-existing",
				emails: [{ value: "existing@example.com" }],
				name: { givenName: "Ex", familyName: "Isting" },
			});

			expect(secondLogin).to.have.property("token");
			const user = await User.findOne({ googleId: "google-existing" });
			expect(user.lastLogin).to.be.instanceOf(Date);
		});

		it("should throw when google user is deactivated", async () => {
			await authService.findOrCreateFromGoogle({
				id: "google-inactive",
				emails: [{ value: "inactive.google@example.com" }],
				name: { givenName: "In", familyName: "Active" },
			});

			await User.updateOne(
				{ googleId: "google-inactive" },
				{ $set: { isActive: false } },
			);

			try {
				await authService.findOrCreateFromGoogle({
					id: "google-inactive",
					emails: [{ value: "inactive.google@example.com" }],
					name: { givenName: "In", familyName: "Active" },
				});
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).to.match(/deactivated/);
			}
		});
	});

	describe("getUserById", () => {
		it("should return user by id", async () => {
			const created = await authService.register({
				email: "byid@example.com",
				password: "pw123456",
				firstName: "By",
				lastName: "Id",
			});

			const user = await authService.getUserById(created.user._id.toString());
			expect(user.email).to.equal("byid@example.com");
		});

		it("should throw if user is not found", async () => {
			const id = new mongoose.Types.ObjectId().toString();
			try {
				await authService.getUserById(id);
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).to.match(/User not found/);
			}
		});
	});

	describe("listDoctors", () => {
		it("should list only active doctors with mapped shape", async () => {
			const doctor = await authService.register({
				email: "doclist@example.com",
				password: "pw123456",
				firstName: "Doc",
				lastName: "List",
				role: "doctor",
				department: "ENT",
			});

			await authService.register({
				email: "nondoctor@example.com",
				password: "pw123456",
				firstName: "No",
				lastName: "Doctor",
				role: "clerk",
			});

			await User.updateOne(
				{ _id: doctor.user._id },
				{ $set: { isActive: true } },
			);

			const doctors = await authService.listDoctors();
			expect(doctors).to.have.length(1);
			expect(doctors[0]).to.include({
				email: "doclist@example.com",
				firstName: "Doc",
				lastName: "List",
				fullName: "Doc List",
			});
			expect(doctors[0]).to.have.property("id");
		});
	});

	describe("jwt verifyToken", () => {
		it("should verify a token generated by service", async () => {
			const result = await authService.register({
				email: "jwtverify@example.com",
				password: "pw123456",
				firstName: "Jwt",
				lastName: "Verify",
			});

			const payload = verifyToken(result.token);
			expect(payload).to.include({
				email: "jwtverify@example.com",
				role: "clerk",
			});
		});

		it("should throw invalid token error", async () => {
			try {
				verifyToken("invalid.token.value");
				throw new Error("Should have thrown");
			} catch (err) {
				expect(err.message).to.equal("Invalid token");
			}
		});
	});
});
