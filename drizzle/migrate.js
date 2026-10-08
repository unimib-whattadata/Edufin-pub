// .drizzle/migrate.ts:
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const MIGRATIONS_FOLDER = './drizzle'
const IGNORABLE_ERROR_CODES = new Set([
	'42710', // duplicate_object
	'42P07', // duplicate_table
	'42701', // duplicate_column
	'42P16', // invalid_table_definition (e.g. multiple primary keys on rerun)
])

/**
 * @param {string} sqlContent
 * @returns {string[]}
 */
function splitMigrationStatements(sqlContent) {
	return sqlContent
		.split('--> statement-breakpoint')
		.map((statement) => statement.trim())
		.filter(Boolean)
}

/**
 * @param {import('postgres').Sql<{}>} client
 * @returns {Promise<void>}
 */
async function runTolerantSqlMigrations(client) {
	console.warn('Standard migration failed, running tolerant SQL fallback ⚠️')

	const migrationFiles = (await readdir(MIGRATIONS_FOLDER))
		.filter((fileName) => /\d+_.+\.sql$/.test(fileName))
		.sort((firstFile, secondFile) => firstFile.localeCompare(secondFile))

	for (const migrationFile of migrationFiles) {
		const filePath = join(MIGRATIONS_FOLDER, migrationFile)
		const sqlContent = await readFile(filePath, 'utf8')
		const statements = splitMigrationStatements(sqlContent)

		for (const statement of statements) {
			try {
				await client.unsafe(statement)
			} catch (error) {
				const postgresError = /** @type {{ code?: string }} */ (error)

				if (postgresError.code && IGNORABLE_ERROR_CODES.has(postgresError.code)) {
					console.warn(
						`Ignoring duplicate/compatible migration statement from ${migrationFile} (${postgresError.code})`,
					)
					continue
				}

				throw error
			}
		}
	}

	console.log('Tolerant SQL fallback completed ✅')
}

async function runMigration() {
	console.log('Migration started ⌛')

	// Not using the getDbUrl helper function because we aren't copying that into our runtime app prior to deployment in our Dockerfile. We'll live with the code duplication.
	const dbUrl = process.env.DATABASE_URL

	if (!dbUrl) throw new Error('No database url found')

	const client = postgres(dbUrl, {
		max: 1,
	})

	const db = drizzle(client)
	try {
		await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
		console.log('Migration completed ✅')
	} catch (error) {
		console.error('Migration failed 🚨:', error)
		const postgresError = /** @type {{ code?: string }} */ (error)

		if (postgresError.code === '42710') {
			await runTolerantSqlMigrations(client)
			return
		}

		throw error
	} finally {
		await client.end()
	}
}

runMigration().catch((error) => console.error('Error in migration process 🚨:', error))