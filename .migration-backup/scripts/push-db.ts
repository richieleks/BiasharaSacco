import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function pushDatabase() {
  console.log('Pushing database changes...');
  
  try {
    // Run drizzle-kit push and automatically select option 1 (create column)
    const { stdout, stderr } = await execAsync('echo "1" | npx drizzle-kit push', {
      shell: '/bin/bash'
    });
    
    console.log('Database push output:', stdout);
    if (stderr) {
      console.error('Database push errors:', stderr);
    }
    
    console.log('Database schema updated successfully!');
  } catch (error) {
    console.error('Error pushing database:', error);
    process.exit(1);
  }
}

pushDatabase();