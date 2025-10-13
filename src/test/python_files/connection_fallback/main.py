from helper import helper_func
from caller import call_start


def start():
    helper_func()
    local()
    call_start()
    print('ready')


def local():
    return 'done'
