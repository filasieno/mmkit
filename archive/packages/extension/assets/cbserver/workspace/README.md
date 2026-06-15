# mmkit cbserver workspace

This directory is the persistent **CB_DB_ALL** workspace for the internal Docker cbserver.

On first start, mmkit copies bundled assets here and writes `.mmkit-installed`.
The container mounts this folder at `/data/workspace` with `CB_UPDATE_MODE=persistent`.
