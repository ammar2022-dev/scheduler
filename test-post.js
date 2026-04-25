const { Client, PrivateKey } = require("@beblurt/dblurt");

// Configuration
const RPC_NODES = [
    "https://rpc.beblurt.com",
    "https://rpc.blurt.world",
    "https://blurt-rpc.saboin.com"
];

const AUTHOR = "ammarfahim2026";
const POSTING_KEY = "5KUYNYKRggDQ2R2iDhcDnesHsqyTRntpWbATAYEhKZm5Msur2cv";

async function postToBlurt() {
    console.log("🚀 Initializing Blurt client...");
    
    // Initialize client
    const client = new Client(RPC_NODES, { timeout: 15000 });
    
    // Generate unique permlink
    const permlink = `post-${Date.now()}`;
    
    // Prepare the comment operation
    const operations = [
        [
            "comment",
            {
                parent_author: "",
                parent_permlink: "blurt",
                author: AUTHOR,
                permlink: permlink,
                title: "Hello Blurt",
                body: "post from system",
                json_metadata: JSON.stringify({ 
                    tags: ["blurt"],
                    app: "my-node-app/1.0.0"
                })
            }
        ]
    ];
    
    console.log("📝 Creating transaction...");
    
    try {
        // IMPORTANT: Convert string to PrivateKey object
        const privateKey = PrivateKey.from(POSTING_KEY);
        
        // Sign and broadcast - pass the PrivateKey object, not the string
        const tx = await client.broadcast.sendOperations(operations, privateKey);
        
        console.log("\n✅ POST SUCCESSFUL!");
        console.log(`📎 Post URL: https://blurt.blog/@${AUTHOR}/${permlink}`);
        console.log(`🔗 Transaction ID: ${tx.id}`);
        
        return tx;
        
    } catch (error) {
        console.error("\n❌ POST FAILED");
        console.error("Error details:", error.message);
        if (error.data) {
            console.error("Additional data:", error.data);
        }
        throw error;
    }
}

// Execute
postToBlurt().catch(console.error);