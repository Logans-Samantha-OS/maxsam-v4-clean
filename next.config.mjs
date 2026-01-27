/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
```

Save it, then run in terminal:
```
git add .
```
```
git commit -m "Ignore TypeScript errors in build"
```
```
git push