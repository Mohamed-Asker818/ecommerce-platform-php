<?php
class SimpleCache
{
    private $cacheDir;
    private $defaultTTL; 

    public function __construct($defaultTTL = 3600) 
    {
        $this->cacheDir = __DIR__ . '/../Cache/';
        $this->defaultTTL = $defaultTTL;

        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0777, true);
        }
    }

    private function getCacheFilePath($key)
    {
        $filename = preg_replace('/[^a-zA-Z0-9_]/', '_', $key);
        return $this->cacheDir . $filename . '.cache';
    }

    
    public function set($key, $data, $ttl = null)
    {
        $ttl = $ttl ?? $this->defaultTTL;
        $filePath = $this->getCacheFilePath($key);
        $expiry = time() + $ttl;
        $content = serialize(['expiry' => $expiry, 'data' => $data]);

        return file_put_contents($filePath, $content, LOCK_EX) !== false;
    }

    
    public function get($key)
    {
        $filePath = $this->getCacheFilePath($key);

        if (!is_file($filePath)) {
            return false;
        }

        $content = file_get_contents($filePath);
        if ($content === false) {
            return false;
        }

        $cached = @unserialize($content);

        if ($cached === false || !isset($cached['expiry']) || !isset($cached['data'])) {
            @unlink($filePath);
            return false;
        }

        if ($cached['expiry'] < time()) {
            @unlink($filePath);
            return false;
        }

        return $cached['data'];
    }

    
    public function delete($key)
    {
        $filePath = $this->getCacheFilePath($key);
        if (is_file($filePath)) {
            return @unlink($filePath);
        }
        return true;
    }
}
