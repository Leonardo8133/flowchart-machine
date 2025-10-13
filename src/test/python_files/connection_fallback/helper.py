from helper_inner import helper_inner_func


def helper_func():
    helper_inner_func()


class Worker:
    def process(self):
        helper_inner_func()
