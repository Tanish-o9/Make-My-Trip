import sqlite3

def main():
    conn = sqlite3.connect('test_travel_os.db')
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("TABLES:")
    for t in tables:
        tname = t[0]
        print(f"\nTable: {tname}")
        cursor.execute(f"PRAGMA table_info({tname});")
        cols = cursor.fetchall()
        for c in cols:
            print(f"  {c[1]} - {c[2]}")
    conn.close()

if __name__ == '__main__':
    main()
